import { OpenAIProvider } from './openai.ts'

export class OpperProvider extends OpenAIProvider {
    public override id = 'opper'

    constructor(apiKey?: string) {
        super('https://api.opper.ai/v3/compat', apiKey || process.env.OPPER_API_KEY)
    }
}
