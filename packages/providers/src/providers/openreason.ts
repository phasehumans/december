import { OpenAIProvider } from './openai.ts'

export class OpenreasonProvider extends OpenAIProvider {
    public override id = 'openreason'

    constructor(apiKey?: string) {
        super('https://api.openreason.app/v1', apiKey || process.env.OPENREASON_API_KEY)
    }
}
