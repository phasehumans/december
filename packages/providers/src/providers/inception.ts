import { OpenAIProvider } from './openai.ts'

export class InceptionProvider extends OpenAIProvider {
    public override id = 'inception'

    constructor(apiKey?: string) {
        super('https://api.inceptionlabs.ai/v1/', apiKey || process.env.INCEPTION_API_KEY)
    }
}
