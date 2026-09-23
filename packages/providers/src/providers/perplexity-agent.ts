import { OpenAIProvider } from './openai.ts'

export class PerplexityAgentProvider extends OpenAIProvider {
    public override id = 'perplexity-agent'

    constructor(apiKey?: string) {
        super('https://api.perplexity.ai/v1', apiKey || process.env.PERPLEXITY_API_KEY)
    }
}
