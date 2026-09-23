import { OpenAIProvider } from './openai.ts'

export class OvhcloudProvider extends OpenAIProvider {
    public override id = 'ovhcloud'

    constructor(apiKey?: string) {
        super(
            'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
            apiKey || process.env.OVHCLOUD_API_KEY
        )
    }
}
