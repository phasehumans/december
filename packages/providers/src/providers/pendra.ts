import { OpenAIProvider } from './openai.ts'

export class PendraProvider extends OpenAIProvider {
    public override id = 'pendra'

    constructor(apiKey?: string) {
        super('https://api.pendra.ai/api/v1', apiKey || process.env.PENDRA_API_KEY)
    }
}
