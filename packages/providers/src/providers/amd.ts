import { OpenAIProvider } from './openai.ts'

export class AmdProvider extends OpenAIProvider {
    public override id = 'amd'

    constructor(apiKey?: string) {
        super('https://developer.amd.com.cn/radeon/api/v1', apiKey || process.env.AMD_API_KEY)
    }
}
