import { OpenAIProvider } from './openai.ts'

export class LlmtechProvider extends OpenAIProvider {
    public override id = 'llmtech'

    constructor(apiKey?: string) {
        super('https://api.llmtech.eu/v1', apiKey || process.env.LLMTECH_API_KEY)
    }
}
