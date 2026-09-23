import { OpenAIProvider } from './openai.ts'

export class OpencodeProvider extends OpenAIProvider {
    public override id = 'opencode'

    constructor(apiKey?: string) {
        super('https://opencode.ai/zen/v1', apiKey || process.env.OPENCODE_API_KEY)
    }
}
