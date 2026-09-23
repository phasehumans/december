import { OpenAIProvider } from './openai.ts'

export class WallabyProvider extends OpenAIProvider {
    public override id = 'wallaby'

    constructor(apiKey?: string) {
        super('https://api.wallabytoken.com/v1', apiKey || process.env.WALLABY_API_KEY)
    }
}
