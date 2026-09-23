import { OpenAIProvider } from './openai.ts'

export class ImpossiblProvider extends OpenAIProvider {
    public override id = 'impossibl'

    constructor(apiKey?: string) {
        super('https://api.impossibl.com/v1', apiKey || process.env.IMPOSSIBL_API_KEY)
    }
}
