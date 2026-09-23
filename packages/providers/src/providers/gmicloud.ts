import { OpenAIProvider } from './openai.ts'

export class GmicloudProvider extends OpenAIProvider {
    public override id = 'gmicloud'

    constructor(apiKey?: string) {
        super('https://api.gmi-serving.com/v1', apiKey || process.env.GMICLOUD_API_KEY)
    }
}
