import { OpenAIProvider } from './openai.ts'

export class ChutesProvider extends OpenAIProvider {
    public override id = 'chutes'

    constructor(apiKey?: string) {
        super('https://llm.chutes.ai/v1', apiKey || process.env.CHUTES_API_KEY)
    }
}
