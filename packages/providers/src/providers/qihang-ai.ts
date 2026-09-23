import { OpenAIProvider } from './openai.ts'

export class QihangAiProvider extends OpenAIProvider {
    public override id = 'qihang-ai'

    constructor(apiKey?: string) {
        super('https://api.qhaigc.net/v1', apiKey || process.env.QIHANG_API_KEY)
    }
}
