import { OpenAIProvider } from './openai.ts'

export class TrustedrouterProvider extends OpenAIProvider {
    public override id = 'trustedrouter'

    constructor(apiKey?: string) {
        super('https://api.trustedrouter.com/v1', apiKey || process.env.TRUSTEDROUTER_API_KEY)
    }
}
