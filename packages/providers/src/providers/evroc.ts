import { OpenAIProvider } from './openai.ts'

export class EvrocProvider extends OpenAIProvider {
    public override id = 'evroc'

    constructor(apiKey?: string) {
        super('https://models.think.evroc.com/v1', apiKey || process.env.EVROC_API_KEY)
    }
}
