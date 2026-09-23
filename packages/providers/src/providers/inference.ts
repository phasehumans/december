import { OpenAIProvider } from './openai.ts'

export class InferenceProvider extends OpenAIProvider {
    public override id = 'inference'

    constructor(apiKey?: string) {
        super('https://inference.net/v1', apiKey || process.env.INFERENCE_API_KEY)
    }
}
