import { OpenAIProvider } from './openai.ts'

export class CoralbricksProvider extends OpenAIProvider {
    public override id = 'coralbricks'

    constructor(apiKey?: string) {
        super('https://inference.coralbricks.ai/v1', apiKey || process.env.CORAL_API_KEY)
    }
}
