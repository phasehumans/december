import { OpenAIProvider } from './openai.ts'

export class PoeProvider extends OpenAIProvider {
    public override id = 'poe'

    constructor(apiKey?: string) {
        super('https://api.poe.com/v1', apiKey || process.env.POE_API_KEY)
    }
}
