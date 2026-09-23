import { OpenAIProvider } from './openai.ts'

export class NanProvider extends OpenAIProvider {
    public override id = 'nan'

    constructor(apiKey?: string) {
        super('https://api.nan.builders/v1', apiKey || process.env.NAN_API_KEY)
    }
}
