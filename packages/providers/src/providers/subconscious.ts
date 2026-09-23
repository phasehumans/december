import { AnthropicProvider } from './anthropic.ts'

export class SubconsciousProvider extends AnthropicProvider {
    public override id = 'subconscious'

    constructor(apiKey?: string) {
        super('https://api.subconscious.dev/v1', apiKey || process.env.SUBCONSCIOUS_API_KEY)
    }
}
