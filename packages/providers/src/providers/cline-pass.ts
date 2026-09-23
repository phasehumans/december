import { OpenAIProvider } from './openai.ts'

export class ClinePassProvider extends OpenAIProvider {
    public override id = 'cline-pass'

    constructor(apiKey?: string) {
        super('https://api.cline.bot/api/v1', apiKey || process.env.CLINE_API_KEY)
    }
}
