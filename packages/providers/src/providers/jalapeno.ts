import { OpenAIProvider } from './openai.ts'

export class JalapenoProvider extends OpenAIProvider {
    public override id = 'jalapeno'

    constructor(apiKey?: string) {
        super('https://api.jalapeno-cloud.ai/v1', apiKey || process.env.JALAPENO_API_KEY)
    }
}
