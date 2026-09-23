import { OpenAIProvider } from './openai.ts'

export class IteracomputeProvider extends OpenAIProvider {
    public override id = 'iteracompute'

    constructor(apiKey?: string) {
        super('https://api.iteracompute.com/v1', apiKey || process.env.ITERACOMPUTE_API_KEY)
    }
}
