import { OpenAIProvider } from './openai.ts'

export class NovaProvider extends OpenAIProvider {
    public override id = 'nova'

    constructor(apiKey?: string) {
        super('https://api.nova.amazon.com/v1', apiKey || process.env.NOVA_API_KEY)
    }
}
