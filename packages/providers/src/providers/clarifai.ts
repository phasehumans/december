import { OpenAIProvider } from './openai.ts'

export class ClarifaiProvider extends OpenAIProvider {
    public override id = 'clarifai'

    constructor(apiKey?: string) {
        super('https://api.clarifai.com/v2/ext/openai/v1', apiKey || process.env.CLARIFAI_PAT)
    }
}
