import { OpenAIProvider } from './openai.ts'

export class OpencodeGoProvider extends OpenAIProvider {
    public override id = 'opencode-go'

    constructor(apiKey?: string) {
        super('https://opencode.ai/zen/go/v1', apiKey || process.env.OPENCODE_API_KEY)
    }
}
