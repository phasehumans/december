import { OpenAIProvider } from './openai.ts'

export class AmbientProvider extends OpenAIProvider {
    public override id = 'ambient'

    constructor(apiKey?: string) {
        super('https://api.ambient.xyz/v1', apiKey || process.env.AMBIENT_API_KEY)
    }
}

export const ambientProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new AmbientProvider(apiKey)
