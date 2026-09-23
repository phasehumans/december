import { OpenAIProvider } from './openai.ts'

export class CloudflareAiGatewayProvider extends OpenAIProvider {
    public override id = 'cloudflare-ai-gateway'

    constructor(apiKey?: string) {
        super('https://gateway.ai.cloudflare.com/v1', apiKey || process.env.CLOUDFLARE_API_TOKEN)
    }
}
