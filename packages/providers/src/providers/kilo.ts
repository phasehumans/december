import { OpenAIProvider } from './openai.ts'

export class KiloProvider extends OpenAIProvider {
    public override id = 'kilo'

    constructor(apiKey?: string) {
        super('https://api.kilo.ai/api/gateway', apiKey || process.env.KILO_API_KEY)
    }
}
