import { OpenAIProvider } from './openai.ts'

export class LongcatProvider extends OpenAIProvider {
    public override id = 'longcat'

    constructor(apiKey?: string) {
        super('https://api.longcat.chat/openai', apiKey || process.env.LONGCAT_API_KEY)
    }
}
