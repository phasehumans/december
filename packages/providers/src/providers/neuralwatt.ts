import { OpenAIProvider } from './openai.ts'

export class NeuralwattProvider extends OpenAIProvider {
    public override id = 'neuralwatt'

    constructor(apiKey?: string) {
        super('https://api.neuralwatt.com/v1', apiKey || process.env.NEURALWATT_API_KEY)
    }
}
