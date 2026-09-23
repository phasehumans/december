import { OpenAIProvider } from './openai.ts'

export class NanoGptProvider extends OpenAIProvider {
    public override id = 'nano-gpt'

    constructor(apiKey?: string) {
        super('https://nano-gpt.com/api/v1', apiKey || process.env.NANO_GPT_API_KEY)
    }
}
