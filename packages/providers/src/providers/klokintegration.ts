import { OpenAIProvider } from './openai.ts'

export class KlokintegrationProvider extends OpenAIProvider {
    public override id = 'klokintegration'

    constructor(apiKey?: string) {
        super(
            'https://api-gw.klok.ipaas.se/proxy/kloker-key/v1',
            apiKey || process.env.KLOKINTEGRATION_API_KEY
        )
    }
}
