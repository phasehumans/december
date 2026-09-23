import { OpenAIProvider } from './openai.ts'

export class ScalewayProvider extends OpenAIProvider {
    public override id = 'scaleway'

    constructor(apiKey?: string) {
        super('https://api.scaleway.ai/v1', apiKey || process.env.SCALEWAY_API_KEY)
    }
}
