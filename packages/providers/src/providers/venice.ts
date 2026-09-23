import { OpenAIProvider } from './openai.ts'

export class VeniceProvider extends OpenAIProvider {
    public override id = 'venice'

    constructor(apiKey?: string) {
        super('https://api.venice.ai/api/v1', apiKey || process.env.VENICE_API_KEY)
    }
}
