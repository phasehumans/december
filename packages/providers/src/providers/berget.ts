import { OpenAIProvider } from './openai.ts'

export class BergetProvider extends OpenAIProvider {
    public override id = 'berget'

    constructor(apiKey?: string) {
        super('https://api.berget.ai/v1', apiKey || process.env.BERGET_API_KEY)
    }
}
