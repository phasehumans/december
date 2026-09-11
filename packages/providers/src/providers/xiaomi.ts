import { OpenAIProvider } from './openai.ts'

export class XiaomiProvider extends OpenAIProvider {
    public override id = 'xiaomi'

    constructor(apiKey?: string) {
        super(
            'https://api.xiaomimimo.com/v1',
            apiKey || process.env.XIAOMI_API_KEY || process.env.MIMO_API_KEY
        )
    }
}

export const xiaomiProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new XiaomiProvider(apiKey)
