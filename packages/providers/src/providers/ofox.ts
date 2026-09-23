import { OpenAIProvider } from './openai.ts'

export class OfoxProvider extends OpenAIProvider {
    public override id = 'ofox'

    constructor(apiKey?: string) {
        super('https://api.ofox.ai/v1', apiKey || process.env.OFOX_API_KEY)
    }
}
