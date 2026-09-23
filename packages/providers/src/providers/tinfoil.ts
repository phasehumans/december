import { OpenAIProvider } from './openai.ts'

export class TinfoilProvider extends OpenAIProvider {
    public override id = 'tinfoil'

    constructor(apiKey?: string) {
        super('https://inference.tinfoil.sh/v1', apiKey || process.env.TINFOIL_API_KEY)
    }
}
