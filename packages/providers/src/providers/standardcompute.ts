import { OpenAIProvider } from './openai.ts'

export class StandardcomputeProvider extends OpenAIProvider {
    public override id = 'standardcompute'

    constructor(apiKey?: string) {
        super('https://api.stdcmpt.com/v1', apiKey || process.env.STANDARDCOMPUTE_API_KEY)
    }
}
