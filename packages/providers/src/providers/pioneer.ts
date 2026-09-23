import { OpenAIProvider } from './openai.ts'

export class PioneerProvider extends OpenAIProvider {
    public override id = 'pioneer'

    constructor(apiKey?: string) {
        super('https://api.pioneer.ai/v1', apiKey || process.env.PIONEER_API_KEY)
    }
}
