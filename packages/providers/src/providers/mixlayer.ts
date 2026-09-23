import { OpenAIProvider } from './openai.ts'

export class MixlayerProvider extends OpenAIProvider {
    public override id = 'mixlayer'

    constructor(apiKey?: string) {
        super('https://models.mixlayer.ai/v1', apiKey || process.env.MIXLAYER_API_KEY)
    }
}
