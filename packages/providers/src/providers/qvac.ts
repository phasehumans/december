import { OpenAIProvider } from './openai.ts'

export class QvacProvider extends OpenAIProvider {
    public override id = 'qvac'

    constructor(apiKey?: string) {
        super('https://api.qvac.ai/v1', apiKey || process.env.QVAC_API_KEY)
    }
}
