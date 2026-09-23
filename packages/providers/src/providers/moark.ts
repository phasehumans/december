import { OpenAIProvider } from './openai.ts'

export class MoarkProvider extends OpenAIProvider {
    public override id = 'moark'

    constructor(apiKey?: string) {
        super('https://moark.com/v1', apiKey || process.env.MOARK_API_KEY)
    }
}
