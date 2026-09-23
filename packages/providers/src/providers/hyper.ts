import { OpenAIProvider } from './openai.ts'

export class HyperProvider extends OpenAIProvider {
    public override id = 'hyper'

    constructor(apiKey?: string) {
        super('https://hyper.charm.land/v1', apiKey || process.env.HYPER_API_KEY)
    }
}
