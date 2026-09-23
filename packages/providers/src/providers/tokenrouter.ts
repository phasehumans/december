import { OpenAIProvider } from './openai.ts'

export class TokenrouterProvider extends OpenAIProvider {
    public override id = 'tokenrouter'

    constructor(apiKey?: string) {
        super('https://api.tokenrouter.com/v1', apiKey || process.env.TOKENROUTER_API_KEY)
    }
}
