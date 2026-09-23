import { OpenAIProvider } from './openai.ts'

export class BlueclawProvider extends OpenAIProvider {
    public override id = 'blueclaw'

    constructor(apiKey?: string) {
        super('https://openai.blueclaw.network/v1', apiKey || process.env.BLUECLAW_API_KEY)
    }
}
