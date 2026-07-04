#!/usr/bin/env node
import { render } from 'ink'
import React from 'react'
import { App } from '@december/tui'
import {
    Agent,
    AgentHarness,
    FileSessionRepository,
    ProviderConfig,
    getProviderConfig,
    loadConfig,
} from '@december/agent'
import pkg from '../package.json' with { type: 'json' }
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
import { localOperations } from './local-operations'

async function main() {
    let providerConfig = await getProviderConfig()

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

    const harness = new AgentHarness({
        baseSystemPrompt:
            'You are December, an autonomous software engineer. You have access to tools. When executing code, please use JSON schemas for tool inputs.',
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
        modelOptions: providerConfig?.model ? { model: providerConfig.model } : undefined,
        sessionRepository: new FileSessionRepository(),
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
    // Mock user email until backend login fully provides it. We show it only if logged in via December.
    const userEmail = config.decemberToken ? 'phasehumans@gmail.com' : undefined

    render(
        React.createElement(App, { agent, isAuthenticated, cliVersion: pkg.version, userEmail }),
        { exitOnCtrlC: false }
    )
}

main().catch(console.error)
