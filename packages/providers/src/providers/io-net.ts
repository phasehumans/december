import { OpenAIProvider } from './openai.ts'

export class IoNetProvider extends OpenAIProvider {
    public override id = 'io-net'

    constructor(apiKey?: string) {
        super(
            'https://api.intelligence.io.solutions/api/v1',
            apiKey || process.env.IOINTELLIGENCE_API_KEY
        )
    }
}
