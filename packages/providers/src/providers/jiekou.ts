import { OpenAIProvider } from './openai.ts'

export class JiekouProvider extends OpenAIProvider {
    public override id = 'jiekou'

    constructor(apiKey?: string) {
        super('https://api.jiekou.ai/openai', apiKey || process.env.JIEKOU_API_KEY)
    }
}
