import { OpenAIProvider } from './openai.ts'

export class XpersonaProvider extends OpenAIProvider {
    public override id = 'xpersona'

    constructor(apiKey?: string) {
        super('https://www.xpersona.co/v1', apiKey || process.env.XPERSONA_API_KEY)
    }
}
