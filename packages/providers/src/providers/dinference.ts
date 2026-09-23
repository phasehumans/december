import { OpenAIProvider } from './openai.ts'

export class DinferenceProvider extends OpenAIProvider {
    public override id = 'dinference'

    constructor(apiKey?: string) {
        super('https://api.dinference.com/v1', apiKey || process.env.DINFERENCE_API_KEY)
    }
}
