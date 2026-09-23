import { OpenAIProvider } from './openai.ts'

export class CrusoeProvider extends OpenAIProvider {
    public override id = 'crusoe'

    constructor(apiKey?: string) {
        super('https://api.inference.crusoecloud.com/v1', apiKey || process.env.CRUSOE_API_KEY)
    }
}
