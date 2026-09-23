import { OpenAIProvider } from './openai.ts'

export class MorphProvider extends OpenAIProvider {
    public override id = 'morph'

    constructor(apiKey?: string) {
        super('https://api.morphllm.com/v1', apiKey || process.env.MORPH_API_KEY)
    }
}
