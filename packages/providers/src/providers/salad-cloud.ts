import { OpenAIProvider } from './openai.ts'

export class SaladCloudProvider extends OpenAIProvider {
    public override id = 'salad-cloud'

    constructor(apiKey?: string) {
        super('https://matrix.salad.com/api/v1', apiKey || process.env.SALAD_CLOUD_API_KEY)
    }
}
