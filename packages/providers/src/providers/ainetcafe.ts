import { OpenAIProvider } from './openai.ts'

export class AinetcafeProvider extends OpenAIProvider {
    public override id = 'ainetcafe'

    constructor(apiKey?: string) {
        super('https://microquickjs.com/v1', apiKey || process.env.AINETCAFE_API_KEY)
    }
}
