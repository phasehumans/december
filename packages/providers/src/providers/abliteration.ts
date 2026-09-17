import { OpenAIProvider } from './openai.ts'

export class AbliterationProvider extends OpenAIProvider {
    public override id = 'abliteration'

    constructor(apiKey?: string) {
        super(
            'https://api.abliteration.ai/v1',
            apiKey || process.env.ABLITERATION_API_KEY || process.env.ABLIT_KEY
        )
    }
}

export const abliterationProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new AbliterationProvider(apiKey)
