import { OpenAIProvider } from './openai.ts'

export class QiniuAiProvider extends OpenAIProvider {
    public override id = 'qiniu-ai'

    constructor(apiKey?: string) {
        super('https://api.qnaigc.com/v1', apiKey || process.env.QINIU_API_KEY)
    }
}
