import { OpenAIProvider } from './openai.ts'

export class AgnesProvider extends OpenAIProvider {
    public override id = 'agnes'

    constructor(apiKey?: string) {
        super(
            'https://apihub.agnes-ai.com/v1',
            apiKey || process.env.AGNES_API_KEY || process.env.AGNES_AI_KEY
        )
    }
}

export const agnesProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new AgnesProvider(apiKey)
