import { OpenAIProvider } from './openai.ts'

export class CrofProvider extends OpenAIProvider {
    public override id = 'crof'

    constructor(apiKey?: string) {
        super('https://crof.ai/v1', apiKey || process.env.CROF_API_KEY)
    }
}
