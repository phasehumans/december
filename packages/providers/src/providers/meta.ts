import { OpenAIProvider } from './openai.ts'

export class MetaProvider extends OpenAIProvider {
    public override id = 'meta'

    constructor(apiKey?: string) {
        super(
            'https://api.meta.ai/v1',
            apiKey || process.env.META_API_KEY || process.env.MODEL_API_KEY
        )
    }
}
