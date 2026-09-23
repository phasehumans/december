import { OpenAIProvider } from './openai.ts'

export class ModelisProvider extends OpenAIProvider {
    public override id = 'modelis'

    constructor(apiKey?: string) {
        super('https://modelishub.com/v1', apiKey || process.env.MODELIS_API_KEY)
    }
}
