import { OpenAIProvider } from './openai.ts'

export class TemprProvider extends OpenAIProvider {
    public override id = 'tempr'

    constructor(apiKey?: string) {
        super('https://api.temprhq.io/v1', apiKey || process.env.TEMPR_API_KEY)
    }
}
