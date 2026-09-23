import { OpenAIProvider } from './openai.ts'

export class DigitaloceanProvider extends OpenAIProvider {
    public override id = 'digitalocean'

    constructor(apiKey?: string) {
        super('https://inference.do-ai.run/v1', apiKey || process.env.DIGITALOCEAN_ACCESS_TOKEN)
    }
}
