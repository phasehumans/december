import { OpenAIProvider } from './openai.ts'

export class TheGridAiProvider extends OpenAIProvider {
    public override id = 'the-grid-ai'

    constructor(apiKey?: string) {
        super('https://api.thegrid.ai/v1', apiKey || process.env.THEGRID_API_KEY)
    }
}
