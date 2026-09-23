import { OpenAIProvider } from './openai.ts'

export class LlmtrProvider extends OpenAIProvider {
    public override id = 'llmtr'

    constructor(apiKey?: string) {
        super('https://llmtr.com/v1', apiKey || process.env.LLMTR_API_KEY)
    }
}
