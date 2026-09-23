import { OpenAIProvider } from './openai.ts'

export class EdenaiProvider extends OpenAIProvider {
    public override id = 'edenai'

    constructor(apiKey?: string) {
        super('https://api.edenai.run/v3', apiKey || process.env.EDENAI_API_KEY)
    }
}
