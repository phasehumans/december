import { OpenAIProvider } from './openai.ts'

export class TensorxProvider extends OpenAIProvider {
    public override id = 'tensorx'

    constructor(apiKey?: string) {
        super('https://api.tensorx.ai/v1', apiKey || process.env.TENSORX_API_KEY)
    }
}
