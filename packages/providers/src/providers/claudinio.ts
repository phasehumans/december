import { OpenAIProvider } from './openai.ts'

export class ClaudinioProvider extends OpenAIProvider {
    public override id = 'claudinio'

    constructor(apiKey?: string) {
        super('https://api.claudin.io/v1', apiKey || process.env.CLAUDINIO_API_KEY)
    }
}
