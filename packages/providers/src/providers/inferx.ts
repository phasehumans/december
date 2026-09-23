import { OpenAIProvider } from './openai.ts'

export class InferxProvider extends OpenAIProvider {
    public override id = 'inferx'

    constructor(apiKey?: string) {
        super('https://model.inferx.net/endpoints/v1', apiKey || process.env.INFERX_API_KEY)
    }
}
