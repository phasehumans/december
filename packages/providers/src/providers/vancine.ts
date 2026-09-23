import { OpenAIProvider } from './openai.ts'

export class VancineProvider extends OpenAIProvider {
    public override id = 'vancine'

    constructor(apiKey?: string) {
        super('https://vancine.com/v1', apiKey || process.env.VANCINE_API_KEY)
    }
}
