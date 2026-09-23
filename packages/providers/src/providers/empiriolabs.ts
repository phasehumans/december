import { OpenAIProvider } from './openai.ts'

export class EmpiriolabsProvider extends OpenAIProvider {
    public override id = 'empiriolabs'

    constructor(apiKey?: string) {
        super('https://api.empiriolabs.ai/v1', apiKey || process.env.EMPIRIOLABS_API_KEY)
    }
}
