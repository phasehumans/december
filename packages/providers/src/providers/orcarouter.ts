import { OpenAIProvider } from './openai.ts'

export class OrcarouterProvider extends OpenAIProvider {
    public override id = 'orcarouter'

    constructor(apiKey?: string) {
        super('https://api.orcarouter.ai/v1', apiKey || process.env.ORCAROUTER_API_KEY)
    }
}
