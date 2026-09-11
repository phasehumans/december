import { OpenAIProvider } from './openai.ts'

export class ZAIProvider extends OpenAIProvider {
    public override id = 'zai'

    constructor(apiKey?: string) {
        super(
            process.env.ZAI_BASE_URL ||
                process.env.ZHIPUAI_BASE_URL ||
                'https://api.z.ai/api/coding/paas/v4',
            apiKey ||
                process.env.ZAI_API_KEY ||
                process.env.ZHIPUAI_API_KEY ||
                process.env.ZHIPU_API_KEY
        )
    }
}

export { ZAIProvider as ZhipuAIProvider }
