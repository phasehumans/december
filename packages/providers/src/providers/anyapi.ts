import { OpenAIProvider } from './openai.ts'

export class AnyapiProvider extends OpenAIProvider {
    public override id = 'anyapi'

    constructor(apiKey?: string) {
        super('https://api.anyapi.ai/v1', apiKey || process.env.ANYAPI_API_KEY)
    }
}
