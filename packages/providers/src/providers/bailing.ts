import { OpenAIProvider } from './openai.ts'

export class BailingProvider extends OpenAIProvider {
    public override id = 'bailing'

    constructor(apiKey?: string) {
        super(
            'https://api.tbox.cn/api/llm/v1/chat/completions',
            apiKey || process.env.BAILING_API_TOKEN
        )
    }
}
