import { OpenAIProvider } from './openai.ts'

export class KimiCodePlanCnProvider extends OpenAIProvider {
    public override id = 'kimi-code-plan-cn'

    constructor(apiKey?: string) {
        super('https://api.kimi.com/coding/v1', apiKey || process.env.KIMI_API_KEY)
    }
}
