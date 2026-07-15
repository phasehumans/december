import {
    openaiProvider,
    anthropicProvider,
    geminiProvider,
    openrouterProvider,
} from '@december/providers'

export function instantiateProvider(provider: string, apiKey: string): any {
    switch (provider) {
        case 'openai':
            return openaiProvider(undefined, apiKey)
        case 'anthropic':
            return anthropicProvider(undefined, apiKey)
        case 'gemini':
        case 'google':
            return geminiProvider(apiKey)
        case 'openrouter':
            return openrouterProvider(apiKey)
        case 'deepseek':
            return openaiProvider('https://api.deepseek.com', apiKey)
        case 'groq':
            return openaiProvider('https://api.groq.com/openai/v1', apiKey)
        case 'huggingface':
            return openaiProvider('https://api-inference.huggingface.co/v1/', apiKey)
        case 'moonshot':
            return openaiProvider('https://api.moonshot.cn/v1', apiKey)
        case 'mistral':
            return openaiProvider('https://api.mistral.ai/v1', apiKey)
        case 'xai':
            return openaiProvider('https://api.x.ai/v1', apiKey)
        case 'zai':
            return openaiProvider('https://api.zai.ai/v1', apiKey)
        default:
            const proxyUrl = `http://localhost:${process.env.DECEMBER_SERVER_PORT || 3000}/api/v1`
            return openaiProvider(proxyUrl, apiKey)
    }
}
