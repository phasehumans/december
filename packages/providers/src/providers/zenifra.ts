import { OpenAIProvider } from './openai.ts'

export class ZenifraProvider extends OpenAIProvider {
    public override id = 'zenifra'

    constructor(apiKey?: string) {
        super('https://ai.zenifra.com/v1', apiKey || process.env.ZENIFRA_AI_KEY)
    }
}
