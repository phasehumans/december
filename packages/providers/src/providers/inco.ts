import { OpenAIProvider } from './openai.ts'

export class IncoProvider extends OpenAIProvider {
    public override id = 'inco'

    constructor(apiKey?: string) {
        super('https://api.inco.ai/v1', apiKey || process.env.INCO_API_KEY)
    }
}
