import { OpenAIProvider } from './openai.ts'

export class AurikoProvider extends OpenAIProvider {
    public override id = 'auriko'

    constructor(apiKey?: string) {
        super('https://api.auriko.ai/v1', apiKey || process.env.AURIKO_API_KEY)
    }
}

export const aurikoProvider = (apiKey?: string, defaultHeaders?: Record<string, string>) =>
    new AurikoProvider(apiKey)
