import { OpenAIProvider } from './openai.ts'

export class MistralProvider extends OpenAIProvider {
    public id = 'mistral'

    constructor(apiKey?: string) {
        super('https://api.mistral.ai/v1', apiKey || process.env.MISTRAL_API_KEY)
    }
}
