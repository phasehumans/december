import { OpenAIProvider } from './openai.ts'

export class SensenovaProvider extends OpenAIProvider {
    public override id = 'sensenova'

    constructor(apiKey?: string) {
        super('https://token.sensenova.cn/v1', apiKey || process.env.SENSENOVA_API_KEY)
    }
}
