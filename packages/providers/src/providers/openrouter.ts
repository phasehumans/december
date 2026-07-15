import { openaiProvider } from './openai.ts'
import { LLMProvider } from '../types.ts'

export function openrouterProvider(apiKey?: string): LLMProvider {
    const key = apiKey || process.env.OPENROUTER_API_KEY

    const provider = openaiProvider('https://openrouter.ai/api/v1', key, {
        'HTTP-Referer': 'https://december.dev',
        'X-Title': 'December Cloud',
    })

    return {
        ...provider,
        id: 'openrouter',
    }
}
