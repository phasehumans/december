import { OpenAIProvider } from './openai.ts'

export class ZAIProvider extends OpenAIProvider {
    public id = 'zai'

    constructor(apiKey?: string) {
        super('https://api.z.ai/api/coding/paas/v4', apiKey || process.env.ZAI_API_KEY)
    }
}
