import { OpenAIProvider } from './openai.ts'

export class VolcengineProvider extends OpenAIProvider {
    public override id = 'volcengine'

    constructor(apiKey?: string) {
        super('https://ark.cn-beijing.volces.com/api/v3', apiKey || process.env.ARK_API_KEY)
    }
}
