#!/usr/bin/env bun
import { render } from 'ink'
import React from 'react'
import { App } from '@december/tui'
import { Agent, OpenAIProvider } from '@december/agent'
import { BashTool, ReadFileTool, WriteFileTool, LsTool } from '@december/tools'

async function main() {
    // Determine the API key and Base URL based on whether the user is using BYOK or December Wallet.
    // If OPENROUTER_API_KEY is present, we use OpenRouter (BYOK).
    // Otherwise, we could default to `https://api.december.com/v1` with a JWT from `DECEMBER_TOKEN`.
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || 'dummy'
    const baseURL = process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined

    const agent = new Agent({
        systemPrompt:
            'You are December, an autonomous software engineer. You have access to bash, read, write, and ls tools. When executing code, please use JSON schemas for tool inputs.',
        llm: new OpenAIProvider(apiKey, baseURL, 'gpt-4o'), // or "anthropic/claude-3.5-sonnet" on openrouter
        tools: [BashTool, ReadFileTool, WriteFileTool, LsTool],
    })

    render(React.createElement(App, { agent }), { exitOnCtrlC: false })
}

main().catch(console.error)
