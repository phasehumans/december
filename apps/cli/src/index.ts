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
} from '@december/tools'
import { App } from '@december/tui'
import { render } from 'ink'
import React from 'react'

import pkg from '../package.json' with { type: 'json' }

import { loginViaBrowser, loginViaDeviceCode } from './auth'
import { localOperations } from './local-operations'

const originalConsoleError = console.error

async function main() {
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

    render(
        React.createElement(App, {
            agent,
            isAuthenticated,
            cliVersion: pkg.version,
            userEmail,
            sessionRepository,
            onLogin: loginViaBrowser,
            onLoginHeadless: (onCode: (code: string, uri: string) => void) =>
                loginViaDeviceCode('http://localhost:4000', onCode), // Replace with prod URL later
        }),
        { exitOnCtrlC: false }
    )
}

main().catch(originalConsoleError)
