import { OpenAIProvider } from './openai.ts'

export class HeliconeProvider extends OpenAIProvider {
    public override id = 'helicone'

    constructor(apiKey?: string) {
        super('https://ai-gateway.helicone.ai/v1', apiKey || process.env.HELICONE_API_KEY)
    }
}
