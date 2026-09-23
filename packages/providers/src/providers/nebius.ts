import { OpenAIProvider } from './openai.ts'

export class NebiusProvider extends OpenAIProvider {
    public override id = 'nebius'

    constructor(apiKey?: string) {
        super('https://api.tokenfactory.nebius.com/v1', apiKey || process.env.NEBIUS_API_KEY)
    }
}
