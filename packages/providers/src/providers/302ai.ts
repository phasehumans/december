import { OpenAIProvider } from './openai.ts'

export class ThreeZeroTwoAIProvider extends OpenAIProvider {
    public override id = '302ai'

    constructor(apiKey?: string) {
        super('https://api.302.ai/v1', apiKey || process.env['302AI_API_KEY'])
    }
}
