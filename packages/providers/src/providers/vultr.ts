import { OpenAIProvider } from './openai.ts'

export class VultrProvider extends OpenAIProvider {
    public override id = 'vultr'

    constructor(apiKey?: string) {
        super('https://api.vultrinference.com/v1', apiKey || process.env.VULTR_API_KEY)
    }
}
