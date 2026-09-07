import { OpenAIProvider } from './openai.ts'

export class MoonshotProvider extends OpenAIProvider {
    public override id = 'moonshot'

    constructor(apiKey?: string) {
        super(
            'https://api.moonshot.ai/v1',
            apiKey || process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY
        )
    }
}
