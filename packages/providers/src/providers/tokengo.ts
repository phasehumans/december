import { OpenAIProvider } from './openai.ts'

export class TokengoProvider extends OpenAIProvider {
    public override id = 'tokengo'

    constructor(apiKey?: string) {
        super('https://api.tokengo.com/v1', apiKey || process.env.TOKENGO_API_KEY)
    }
}
