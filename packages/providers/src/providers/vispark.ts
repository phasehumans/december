import { OpenAIProvider } from './openai.ts'

export class VisparkProvider extends OpenAIProvider {
    public override id = 'vispark'

    constructor(apiKey?: string) {
        super('https://api.lab.vispark.in/v1', apiKey || process.env.VISPARK_LAB_API_KEY)
    }
}
