import { OpenAIProvider } from './openai.ts'

export class WaferAiProvider extends OpenAIProvider {
    public override id = 'wafer.ai'

    constructor(apiKey?: string) {
        super('https://pass.wafer.ai/v1', apiKey || process.env.WAFER_API_KEY)
    }
}
