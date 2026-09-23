import { OpenAIProvider } from './openai.ts'

export class V0Provider extends OpenAIProvider {
    public override id = 'v0'

    constructor(apiKey?: string) {
        super('https://api.v0.dev/v1', apiKey || process.env.V0_API_KEY)
    }
}
