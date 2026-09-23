import { OpenAIProvider } from './openai.ts'

export class TencentTokenhubProvider extends OpenAIProvider {
    public override id = 'tencent-tokenhub'

    constructor(apiKey?: string) {
        super('https://tokenhub.tencentmaas.com/v1', apiKey || process.env.TENCENT_TOKENHUB_API_KEY)
    }
}
