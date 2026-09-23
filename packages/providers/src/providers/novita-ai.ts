import { OpenAIProvider } from './openai.ts'

export class NovitaAiProvider extends OpenAIProvider {
    public override id = 'novita-ai'

    constructor(apiKey?: string) {
        super('https://api.novita.ai/openai', apiKey || process.env.NOVITA_API_KEY)
    }
}
