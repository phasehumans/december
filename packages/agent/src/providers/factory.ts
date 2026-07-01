import { LLMProvider } from '../llm'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'

export interface ProviderConfig {
    provider: 'openai' | 'anthropic' | 'openrouter'
    apiKey: string
    model?: string
}

export function createProvider(config: ProviderConfig): LLMProvider {
    if (!config.apiKey) throw new Error(`Missing API Key for provider ${config.provider}`)

    switch (config.provider) {
        case 'openai':
            return new OpenAIProvider(config.apiKey, undefined, config.model || 'gpt-4o')
        case 'openrouter':
            return new OpenAIProvider(
                config.apiKey,
                'https://openrouter.ai/api/v1',
                config.model || 'anthropic/claude-3.5-sonnet'
            )
        case 'anthropic':
            return new AnthropicProvider(
                config.apiKey,
                config.model || 'claude-3-5-sonnet-20240620'
            )
        default:
            throw new Error(`Unsupported provider: ${config.provider}`)
    }
}
