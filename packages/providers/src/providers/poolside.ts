import { OpenAIProvider } from './openai.ts'

export class PoolsideProvider extends OpenAIProvider {
    public override id = 'poolside'

    constructor(apiKey?: string) {
        super('https://inference.poolside.ai/v1', apiKey || process.env.POOLSIDE_API_KEY)
    }
}
