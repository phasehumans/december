import { OpenAIProvider } from './openai.ts'

export class AihubmixProvider extends OpenAIProvider {
    public override id = 'aihubmix'

    constructor(apiKey?: string) {
        super('https://aihubmix.com/v1', apiKey || process.env.AIHUBMIX_API_KEY)
    }
}
