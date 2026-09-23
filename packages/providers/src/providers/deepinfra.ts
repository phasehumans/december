import { OpenAIProvider } from './openai.ts'

export class DeepinfraProvider extends OpenAIProvider {
    public override id = 'deepinfra'

    constructor(apiKey?: string) {
        super('https://api.deepinfra.com/v1/openai', apiKey || process.env.DEEPINFRA_API_KEY)
    }
}
