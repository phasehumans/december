#!/usr/bin/env node
import { render } from 'ink'
import React from 'react'
import { App } from '@december/tui'
import {
    Agent,
    createProvider,
    ProviderConfig,
    getProviderConfig,
    OpenAIProvider,
} from '@december/agent'
import {
    BashTool,
    ReadFileTool,
    WriteFileTool,
    LsTool,
    EditFileTool,
    FindFilesTool,
    GrepSearchTool,
    SubagentTool,
} from '@december/tools'
import { localOperations } from './local-operations'

async function main() {
    let providerConfig = await getProviderConfig()

    // If not authenticated, we pass a dummy provider so the Agent can boot.
    // The TUI will intercept prompts and force them to /login
    const llm = providerConfig
        ? createProvider(providerConfig)
        : new OpenAIProvider('dummy', undefined, 'gpt-4o')
    const isAuthenticated = !!providerConfig

    const agent = new Agent({
        systemPrompt:
            'You are December, an autonomous software engineer. You have access to tools. When executing code, please use JSON schemas for tool inputs.',
        llm: llm,
        tools: [
            BashTool,
            ReadFileTool,
            WriteFileTool,
            LsTool,
            EditFileTool,
            FindFilesTool,
            GrepSearchTool,
            SubagentTool,
        ],
        operations: localOperations,
    })

    await agent.loadContext()

    render(React.createElement(App, { agent, isAuthenticated }), { exitOnCtrlC: false })
}

main().catch(console.error)
