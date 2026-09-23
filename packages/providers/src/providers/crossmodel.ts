import { OpenAIProvider } from './openai.ts'

export class CrossmodelProvider extends OpenAIProvider {
    public override id = 'crossmodel'

    constructor(apiKey?: string) {
        super('https://api.crossmodel.ai/v1', apiKey || process.env.CROSSMODEL_API_KEY)
    }
}
