import { OpenAIProvider } from './openai.ts'

export class KenariProvider extends OpenAIProvider {
    public override id = 'kenari'

    constructor(apiKey?: string) {
        super('https://kenari.id/v1', apiKey || process.env.KENARI_API_KEY)
    }
}
