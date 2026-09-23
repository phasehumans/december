import { OpenAIProvider } from './openai.ts'

export class BothubProvider extends OpenAIProvider {
    public override id = 'bothub'

    constructor(apiKey?: string) {
        super('https://openai.bothub.ru/v1', apiKey || process.env.BOTHUB_API_KEY)
    }
}
