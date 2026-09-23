import { OpenAIProvider } from './openai.ts'

export class LilacProvider extends OpenAIProvider {
    public override id = 'lilac'

    constructor(apiKey?: string) {
        super('https://api.getlilac.com/v1', apiKey || process.env.LILAC_API_KEY)
    }
}
