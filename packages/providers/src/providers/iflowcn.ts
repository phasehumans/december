import { OpenAIProvider } from './openai.ts'

export class IflowcnProvider extends OpenAIProvider {
    public override id = 'iflowcn'

    constructor(apiKey?: string) {
        super('https://apis.iflow.cn/v1', apiKey || process.env.IFLOW_API_KEY)
    }
}
