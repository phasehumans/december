import { OpenAIProvider } from './openai.ts'

export class SyntheticProvider extends OpenAIProvider {
    public override id = 'synthetic'

    constructor(apiKey?: string) {
        super('https://api.synthetic.new/openai/v1', apiKey || process.env.SYNTHETIC_API_KEY)
    }
}
