import { OpenAIProvider } from './openai.ts'

export class InferProvider extends OpenAIProvider {
    public override id = 'infer'

    constructor(apiKey?: string) {
        super('https://infer.flow7.org/v1', apiKey || process.env.INFER_API_KEY)
    }
}
