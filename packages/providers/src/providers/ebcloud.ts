import { OpenAIProvider } from './openai.ts'

export class EbcloudProvider extends OpenAIProvider {
    public override id = 'ebcloud'

    constructor(apiKey?: string) {
        super('https://maas-api.ebcloud.com/v1', apiKey || process.env.EBCLOUD_API_KEY)
    }
}
