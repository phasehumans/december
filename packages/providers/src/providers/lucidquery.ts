import { OpenAIProvider } from './openai.ts'

export class LucidqueryProvider extends OpenAIProvider {
    public override id = 'lucidquery'

    constructor(apiKey?: string) {
        super('https://api.lucidquery.com/v1', apiKey || process.env.LUCIDQUERY_API_KEY)
    }
}
