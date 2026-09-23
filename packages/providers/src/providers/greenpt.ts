import { OpenAIProvider } from './openai.ts'

export class GreenptProvider extends OpenAIProvider {
    public override id = 'greenpt'

    constructor(apiKey?: string) {
        super('https://api.greenpt.ai/v1', apiKey || process.env.GREENPT_API_KEY)
    }
}
