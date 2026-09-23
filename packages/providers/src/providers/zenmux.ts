import { OpenAIProvider } from './openai.ts'

export class ZenmuxProvider extends OpenAIProvider {
    public override id = 'zenmux'

    constructor(apiKey?: string) {
        super('https://zenmux.ai/api/v1', apiKey || process.env.ZENMUX_API_KEY)
    }
}
