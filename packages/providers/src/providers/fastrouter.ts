import { OpenAIProvider } from './openai.ts'

export class FastrouterProvider extends OpenAIProvider {
    public override id = 'fastrouter'

    constructor(apiKey?: string) {
        super('https://go.fastrouter.ai/api/v1', apiKey || process.env.FASTROUTER_API_KEY)
    }
}
