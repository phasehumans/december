import { OpenAIProvider } from './openai.ts'

export class KosmikProvider extends OpenAIProvider {
    public override id = 'kosmik'

    constructor(apiKey?: string) {
        super('https://api.koscompute.com/v1', apiKey || process.env.KOSMIK_API_KEY)
    }
}
