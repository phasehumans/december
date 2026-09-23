import { OpenAIProvider } from './openai.ts'

export class MergeGatewayProvider extends OpenAIProvider {
    public override id = 'merge-gateway'

    constructor(apiKey?: string) {
        super(
            'https://api-gateway.merge.dev/v1/ai-sdk',
            apiKey || process.env.MERGE_GATEWAY_API_KEY
        )
    }
}
