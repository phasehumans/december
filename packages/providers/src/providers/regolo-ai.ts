import { OpenAIProvider } from './openai.ts'

export class RegoloAiProvider extends OpenAIProvider {
    public override id = 'regolo-ai'

    constructor(apiKey?: string) {
        super('https://api.regolo.ai/v1', apiKey || process.env.REGOLO_API_KEY)
    }
}
