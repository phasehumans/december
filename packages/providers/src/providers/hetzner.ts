import { OpenAIProvider } from './openai.ts'

export class HetznerProvider extends OpenAIProvider {
    public override id = 'hetzner'

    constructor(apiKey?: string) {
        super('https://inference.hetzner.com/api/v1', apiKey || process.env.HETZNER_API_KEY)
    }
}
