import { OpenAIProvider } from './openai.ts'

export class OpenRouterProvider extends OpenAIProvider {
    public id = 'openrouter'

    constructor(apiKey?: string) {
        super('https://openrouter.ai/api/v1', apiKey || process.env.OPENROUTER_API_KEY)
    }
}
