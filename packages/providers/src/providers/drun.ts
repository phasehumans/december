import { OpenAIProvider } from './openai.ts'

export class DrunProvider extends OpenAIProvider {
    public override id = 'drun'

    constructor(apiKey?: string) {
        super('https://chat.d.run/v1', apiKey || process.env.DRUN_API_KEY)
    }
}
