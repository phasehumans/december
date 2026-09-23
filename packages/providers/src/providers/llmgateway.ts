import { OpenAIProvider } from './openai.ts'

export class LlmgatewayProvider extends OpenAIProvider {
    public override id = 'llmgateway'

    constructor(apiKey?: string) {
        super('https://api.llmgateway.io/v1', apiKey || process.env.LLMGATEWAY_API_KEY)
    }
}
