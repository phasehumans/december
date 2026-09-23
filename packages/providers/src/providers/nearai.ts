import { OpenAIProvider } from './openai.ts'

export class NearaiProvider extends OpenAIProvider {
    public override id = 'nearai'

    constructor(apiKey?: string) {
        super('https://cloud-api.near.ai/v1', apiKey || process.env.NEARAI_API_KEY)
    }
}
