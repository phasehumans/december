import { OpenAIProvider } from './openai.ts'

export class LlamaProvider extends OpenAIProvider {
    public override id = 'llama'

    constructor(apiKey?: string) {
        super('https://api.llama.com/compat/v1/', apiKey || process.env.LLAMA_API_KEY)
    }
}
