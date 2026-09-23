import { OpenAIProvider } from './openai.ts'

export class KimiCodePlanGlobalProvider extends OpenAIProvider {
    public override id = 'kimi-code-plan-global'

    constructor(apiKey?: string) {
        super('https://api.kimi.ai/coding/v1', apiKey || process.env.KIMI_API_KEY)
    }
}
