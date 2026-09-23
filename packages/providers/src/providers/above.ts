import { OpenAIProvider } from './openai.ts'

export class AboveProvider extends OpenAIProvider {
    public override id = 'above'

    constructor(apiKey?: string) {
        super('https://api.above.dev/v1', apiKey || process.env.ABOVE_API_KEY)
    }
}
