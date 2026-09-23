import { OpenAIProvider } from './openai.ts'

export class DaoxeProvider extends OpenAIProvider {
    public override id = 'daoxe'

    constructor(apiKey?: string) {
        super('https://daoxe.com/v1', apiKey || process.env.DAOXE_API_KEY)
    }
}
