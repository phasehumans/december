import { OpenAIProvider } from './openai.ts'

export class UpstageProvider extends OpenAIProvider {
    public override id = 'upstage'

    constructor(apiKey?: string) {
        super('https://api.upstage.ai/v1/solar', apiKey || process.env.UPSTAGE_API_KEY)
    }
}
