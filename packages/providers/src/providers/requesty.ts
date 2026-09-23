import { OpenAIProvider } from './openai.ts'

export class RequestyProvider extends OpenAIProvider {
    public override id = 'requesty'

    constructor(apiKey?: string) {
        super('https://router.requesty.ai/v1', apiKey || process.env.REQUESTY_API_KEY)
    }
}
