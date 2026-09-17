import { OpenAIProvider } from './openai.ts'

export class AIRouterProvider extends OpenAIProvider {
    public override id = 'airouter'

    constructor(apiKey?: string) {
        super(
            'https://api.ai-router.dev/v1',
            apiKey || process.env.AI_ROUTER_API_KEY || process.env.AIROUTER_API_KEY
        )
    }
}

export const airouterProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new AIRouterProvider(apiKey)
