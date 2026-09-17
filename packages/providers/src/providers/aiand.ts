import { OpenAIProvider } from './openai.ts'

export class AIAndProvider extends OpenAIProvider {
    public override id = 'aiand'

    constructor(apiKey?: string) {
        super('https://api.aiand.com/v1', apiKey || process.env.AIAND_API_KEY)
    }
}

export const aiandProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new AIAndProvider(apiKey)
