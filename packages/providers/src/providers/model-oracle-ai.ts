import { OpenAIProvider } from './openai.ts'

export class ModelOracleAiProvider extends OpenAIProvider {
    public override id = 'model-oracle-ai'

    constructor(apiKey?: string) {
        super('https://api.modeloracle.com/api/v1', apiKey || process.env.MODEL_ORACLE_API_KEY)
    }
}
