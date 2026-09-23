import { OpenAIProvider } from './openai.ts'

export class NeosmithProvider extends OpenAIProvider {
    public override id = 'neosmith'

    constructor(apiKey?: string) {
        super('https://router.neosmith.ai/v1', apiKey || process.env.NEOSMITH_API_KEY)
    }
}
