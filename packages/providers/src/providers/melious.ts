import { OpenAIProvider } from './openai.ts'

export class MeliousProvider extends OpenAIProvider {
    public override id = 'melious'

    constructor(apiKey?: string) {
        super('https://api.melious.ai/v1', apiKey || process.env.MELIOUS_API_KEY)
    }
}
