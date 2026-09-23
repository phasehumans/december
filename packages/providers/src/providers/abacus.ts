import { OpenAIProvider } from './openai.ts'

export class AbacusProvider extends OpenAIProvider {
    public override id = 'abacus'

    constructor(apiKey?: string) {
        super('https://routellm.abacus.ai/v1', apiKey || process.env.ABACUS_API_KEY)
    }
}
