import { AnthropicProvider } from './anthropic.ts'

export class FreemodelProvider extends AnthropicProvider {
    public override id = 'freemodel'

    constructor(apiKey?: string) {
        super('https://cc.freemodel.dev/v1', apiKey || process.env.FREEMODEL_API_KEY)
    }
}
