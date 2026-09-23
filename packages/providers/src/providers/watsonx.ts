import { OpenAIProvider } from './openai.ts'

export class WatsonxProvider extends OpenAIProvider {
    public override id = 'watsonx'

    constructor(apiKey?: string) {
        super('https://us-south.ml.cloud.ibm.com/v1', apiKey || process.env.WATSONX_AI_APIKEY)
    }
}
