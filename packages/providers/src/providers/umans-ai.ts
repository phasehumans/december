import { OpenAIProvider } from './openai.ts'

export class UmansAiProvider extends OpenAIProvider {
    public override id = 'umans-ai'

    constructor(apiKey?: string) {
        super('https://api.code.umans.ai/v1', apiKey || process.env.UMANS_AI_API_KEY)
    }
}
