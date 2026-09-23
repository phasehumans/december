import { OpenAIProvider } from './openai.ts'

export class MeganovaProvider extends OpenAIProvider {
    public override id = 'meganova'

    constructor(apiKey?: string) {
        super('https://api.meganova.ai/v1', apiKey || process.env.MEGANOVA_API_KEY)
    }
}
