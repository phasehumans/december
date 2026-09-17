import { OpenAIProvider } from './openai.ts'

export class AKIProvider extends OpenAIProvider {
    public override id = 'aki'

    constructor(apiKey?: string) {
        super('https://aki.io/v1', apiKey || process.env.AKI_API_KEY || process.env.AKI_IO_KEY)
    }
}

export const akiProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new AKIProvider(apiKey)
