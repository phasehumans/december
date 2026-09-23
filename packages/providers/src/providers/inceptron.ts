import { OpenAIProvider } from './openai.ts'

export class InceptronProvider extends OpenAIProvider {
    public override id = 'inceptron'

    constructor(apiKey?: string) {
        super('https://api.inceptron.io/v1', apiKey || process.env.INCEPTRON_API_KEY)
    }
}
