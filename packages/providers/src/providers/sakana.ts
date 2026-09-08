import { OpenAIProvider } from './openai.ts'

export class SakanaProvider extends OpenAIProvider {
    public override id = 'sakana'

    constructor(apiKey?: string) {
        super(
            'https://api.sakana.ai/v1',
            apiKey || process.env.SAKANA_API_KEY || process.env.FUGU_API_KEY
        )
    }
}
