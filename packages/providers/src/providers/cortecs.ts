import { OpenAIProvider } from './openai.ts'

export class CortecsProvider extends OpenAIProvider {
    public override id = 'cortecs'

    constructor(apiKey?: string) {
        super('https://api.cortecs.ai/v1', apiKey || process.env.CORTECS_API_KEY)
    }
}
