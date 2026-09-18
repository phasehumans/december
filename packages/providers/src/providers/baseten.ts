import { OpenAIProvider } from './openai.ts'

export class BasetenProvider extends OpenAIProvider {
    public override id = 'baseten'

    constructor(apiKey?: string) {
        super('https://inference.baseten.co/v1', apiKey || process.env.BASETEN_API_KEY)
    }
}

export const basetenProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new BasetenProvider(apiKey)
