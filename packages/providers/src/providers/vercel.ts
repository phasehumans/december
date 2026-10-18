import { OpenAIProvider } from './openai.ts'

export class VercelProvider extends OpenAIProvider {
    public override id = 'vercel'

    constructor(apiKey?: string) {
        super('https://ai-gateway.vercel.sh/v1', apiKey || process.env.AI_GATEWAY_API_KEY)
    }
}
