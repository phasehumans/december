import { OpenAIProvider } from './openai.ts'

export class UnorouterProvider extends OpenAIProvider {
    public override id = 'unorouter'

    constructor(apiKey?: string) {
        super('https://api.unorouter.com/v1', apiKey || process.env.UNOROUTER_API_KEY)
    }
}
