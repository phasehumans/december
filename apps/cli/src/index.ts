#!/usr/bin/env node
import { AgentHarness, FileSessionRepository, getProviderConfig, loadConfig } from '@december/agent'
import {
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    OpenRouterProvider,
} from '@december/providers'
import {
    BashTool,
    ReadFileTool,
    WriteFileTool,
    LsTool,
    EditFileTool,
    EditDiffTool,
    FindFilesTool,
    GrepSearchTool,
    SubagentTool,
    AskQuestionTool,
    ManageTaskTool,
    BrowserTool,
    GitHubTool,
    MCPTool,
} from '@december/tools'
import { RootLayout } from '@december/tui'
import { Chat as App } from './app'
import { render } from 'ink'
import React from 'react'

import pkg from '../package.json' with { type: 'json' }

import { loginViaBrowser, loginViaDeviceCode } from './auth'
import { localOperations } from './local-operations'

const originalConsoleError = console.error

async function main() {
    process.title = 'december'
    process.stdout.write('\x1b]0;december\x07')

    // Suppress noisy SDK console logs that corrupt the Ink TUI layout
    console.warn = () => {}
    console.error = () => {}
    console.log = () => {}
    console.info = () => {}

    const providerConfig = await getProviderConfig()

    // If not authenticated, we pass a dummy provider so the Agent can boot.
    // The TUI will intercept prompts and force them to /login
    let llm: any
    if (providerConfig) {
        switch (providerConfig.provider) {
            case 'openai':
                llm = new OpenAIProvider(undefined, providerConfig.apiKey)
                break
            case 'anthropic':
                llm = new AnthropicProvider(providerConfig.apiKey)
                break
            case 'google':
            case 'gemini':
                llm = new GeminiProvider(providerConfig.apiKey)
                break
            case 'openrouter':
                llm = new OpenRouterProvider(providerConfig.apiKey)
                break
            case 'deepseek':
                llm = new OpenAIProvider('https://api.deepseek.com', providerConfig.apiKey)
                break
            case 'groq':
                llm = new OpenAIProvider('https://api.groq.com/openai/v1', providerConfig.apiKey)
                break
            case 'huggingface':
                llm = new OpenAIProvider(
                    'https://api-inference.huggingface.co/v1',
                    providerConfig.apiKey
                )
                break
            case 'kimi':
            case 'moonshoot':
                llm = new OpenAIProvider('https://api.moonshot.cn/v1', providerConfig.apiKey)
                break
            case 'mistral':
                llm = new OpenAIProvider('https://api.mistral.ai/v1', providerConfig.apiKey)
                break
            case 'xai':
                llm = new OpenAIProvider('https://api.x.ai/v1', providerConfig.apiKey)
                break
            case 'zai':
                llm = new OpenAIProvider('https://api.zai.ai/v1', providerConfig.apiKey)
                break
            case 'december_proxy':
                const proxyUrl = process.env.DECEMBER_SERVER_URL || 'http://localhost:3000/api/v1'
                llm = new OpenAIProvider(proxyUrl, providerConfig.apiKey)
                break
        }
    } else {
        llm = new OpenAIProvider(undefined, 'dummy-key')
    }

    const isAuthenticated = !!providerConfig

    const sessionRepository = new FileSessionRepository()
    const sessionId = `session-${Date.now()}`

    const harness = new AgentHarness({
        baseSystemPrompt:
            'You are December, an autonomous software engineer. You have access to tools. When executing code, please use JSON schemas for tool inputs. Before using a tool, you MUST enclose your thought process inside <thought>...</thought> tags. At the end of your work, provide a summary of what you did, highlighting important keywords.',
        llm: llm,
        tools: [
            BashTool,
            ReadFileTool,
            WriteFileTool,
            LsTool,
            EditFileTool,
            EditDiffTool,
            FindFilesTool,
            GrepSearchTool,
            SubagentTool,
            AskQuestionTool,
            ManageTaskTool,
            BrowserTool,
            GitHubTool,
            MCPTool,
        ],
        operations: localOperations,
        modelOptions: { model: providerConfig?.model || 'gemini-3.5-flash' },
        sessionRepository,
        sessionId,
        workspaceDir: process.cwd(),
        hooks: {
            beforeToolCall: async (toolCall) => {
                // Future integration: Hook into the TUI to request user approval for destructive bash commands
            },
        },
    })

    const agent = harness.getAgent()

    await agent.loadContext()

    const config = await loadConfig()
    const userEmail = config.decemberToken ? config.email : undefined

    const args = process.argv.slice(2)
    const command = args[0]

    if (command === 'handoff') {
        console.log('Initiating Cloud Handoff...')
        if (!config.decemberToken) {
            console.error('You must be logged in via `december login` to use handoff.')
            process.exit(1)
        }

        try {
            const { execSync } = require('child_process')
            const fs = require('fs')

            console.log('Zipping workspace state...')
            const archivePath = '.december-handoff.tar.gz'
            execSync(`tar -czf ${archivePath} --exclude=node_modules --exclude=.git .`, {
                stdio: 'inherit',
            })

            console.log('Requesting pre-signed URL from server...')
            const proxyUrl = process.env.DECEMBER_SERVER_URL || 'http://localhost:3000/api/v1'
            const urlRes = await fetch(`${proxyUrl}/cli/handoff/upload-url`, {
                headers: { Authorization: `Bearer ${config.decemberToken}` },
            })
            if (!urlRes.ok) throw new Error(await urlRes.text())
            const { uploadUrl, objectKey } = await urlRes.json()

            console.log('Uploading to MinIO...')
            const fileData = fs.readFileSync(archivePath)
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: fileData,
            })
            if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`)

            console.log('Completing handoff...')
            const sessionRes = await fetch(`${proxyUrl}/cli/handoff/complete`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.decemberToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Handoff from ' + process.cwd().split('/').pop(),
                    messages: harness.getAgent().messages,
                    objectKey,
                }),
            })
            if (!sessionRes.ok) throw new Error(await sessionRes.text())

            // Clean up
            fs.unlinkSync(archivePath)

            console.log('Handoff complete! You can now resume this session on December Cloud.')
        } catch (e: any) {
            console.error('Handoff failed:', e.message)
        }
        process.exit(0)
    }

    if (command === 'login') {
        console.log('Please login via the browser...')
        await loginViaBrowser()
        process.exit(0)
    }

    render(
        React.createElement(
            RootLayout,
            null,
            React.createElement(App, {
                agent,
                isAuthenticated,
                cliVersion: pkg.version,
                userEmail,
                sessionRepository,
                onLogin: loginViaBrowser,
                onLoginHeadless: (onCode: (code: string, uri: string) => void) =>
                    loginViaDeviceCode('http://localhost:4000', onCode),
            })
        ),
        { exitOnCtrlC: false }
    )
}

main().catch(originalConsoleError)
