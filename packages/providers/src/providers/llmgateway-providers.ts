import { OpenAIProvider } from './openai.ts'

export class LlmgatewayProvidersProvider extends OpenAIProvider {
    public override id = 'llmgateway-providers'

    constructor(apiKey?: string) {
        super('https://api.llmgateway.io/v1', apiKey || process.env.LLMGATEWAY_API_KEY)
    }
}
