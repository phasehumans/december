import { OpenAIProvider } from './openai.ts'

export class OllamaCloudProvider extends OpenAIProvider {
    public override id = 'ollama-cloud'

    constructor(apiKey?: string) {
        super('https://ollama.com/v1', apiKey || process.env.OLLAMA_API_KEY)
    }
}
