import { OpenAIProvider } from './openai.ts'

export class CloudferroSherlockProvider extends OpenAIProvider {
    public override id = 'cloudferro-sherlock'

    constructor(apiKey?: string) {
        super(
            'https://api-sherlock.cloudferro.com/openai/v1/',
            apiKey || process.env.CLOUDFERRO_SHERLOCK_API_KEY
        )
    }
}
