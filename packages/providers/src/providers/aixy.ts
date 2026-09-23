import { OpenAIProvider } from './openai.ts'

export class AixyProvider extends OpenAIProvider {
    public override id = 'aixy'

    constructor(apiKey?: string) {
        super('https://api.aixy-gateway.com/v1', apiKey || process.env.AIXY_API_KEY)
    }
}
