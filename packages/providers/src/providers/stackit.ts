import { OpenAIProvider } from './openai.ts'

export class StackitProvider extends OpenAIProvider {
    public override id = 'stackit'

    constructor(apiKey?: string) {
        super(
            'https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1',
            apiKey || process.env.STACKIT_API_KEY
        )
    }
}
