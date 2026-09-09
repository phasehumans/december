import { AnthropicProvider, anthropicProvider } from './anthropic.ts'

import type { Message, ProviderTool } from '../types.ts'

export function resolveThinkingMachinesModel(model?: string): string {
    const name = model || 'thinkingmachines/Inkling'
    if (name === 'inkling') {
        return 'thinkingmachines/Inkling'
    }
    if (name === 'inkling:peft:262144') {
        return 'thinkingmachines/Inkling:peft:262144'
    }
    return name
}

export class ThinkingMachinesProvider extends AnthropicProvider {
    public override id = 'thinkingmachines'

    constructor(apiKey?: string) {
        super(
            'https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api',
            apiKey || process.env.TINKER_API_KEY || process.env.THINKINGMACHINES_API_KEY,
            { 'anthropic-beta': 'oauth-2024-11-18' }
        )
    }

    public override stream(
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ) {
        const mappedOptions = {
            ...modelOptions,
            model: resolveThinkingMachinesModel(modelOptions?.model),
        }
        return super.stream(messages, tools, systemPrompt, mappedOptions, signal)
    }
}

export const thinkingMachinesProvider = (
    apiKey?: string,
    defaultHeaders?: Record<string, string>
) =>
    anthropicProvider(
        'https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api',
        apiKey,
        {
            'anthropic-beta': 'oauth-2024-11-18',
            ...(defaultHeaders || {}),
        }
    )
