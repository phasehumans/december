import { OpenAIProvider } from './openai.ts'

export class ZeldocProvider extends OpenAIProvider {
    public override id = 'zeldoc'

    constructor(apiKey?: string) {
        super('https://api.zeldoc.ai/v1', apiKey || process.env.ZELDOC_API_KEY)
    }
}
