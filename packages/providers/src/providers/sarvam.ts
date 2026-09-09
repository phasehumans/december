import { OpenAIProvider } from './openai.ts'

export class SarvamProvider extends OpenAIProvider {
    public override id = 'sarvam'

    constructor(apiKey?: string) {
        super('https://api.sarvam.ai/v1', apiKey || process.env.SARVAM_API_KEY)
    }
}
