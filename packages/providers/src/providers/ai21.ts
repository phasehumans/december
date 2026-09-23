import { OpenAIProvider } from './openai.ts'

export class Ai21Provider extends OpenAIProvider {
    public override id = 'ai21'

    constructor(apiKey?: string) {
        super('https://api.ai21.com/studio/v1', apiKey || process.env.AI21_API_KEY)
    }
}
