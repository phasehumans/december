import { OpenAIProvider } from './openai.ts'

export class FrogbotProvider extends OpenAIProvider {
    public override id = 'frogbot'

    constructor(apiKey?: string) {
        super('https://app.frogbot.ai/api/v1', apiKey || process.env.FROGBOT_API_KEY)
    }
}
