import { OpenAIProvider } from './openai.ts'

export class SubmodelProvider extends OpenAIProvider {
    public override id = 'submodel'

    constructor(apiKey?: string) {
        super('https://llm.submodel.ai/v1', apiKey || process.env.SUBMODEL_INSTAGEN_ACCESS_KEY)
    }
}
