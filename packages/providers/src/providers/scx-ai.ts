import { OpenAIProvider } from './openai.ts'

export class ScxAiProvider extends OpenAIProvider {
    public override id = 'scx-ai'

    constructor(apiKey?: string) {
        super('https://api.scx.ai/v1', apiKey || process.env.SCX_API_KEY)
    }
}
