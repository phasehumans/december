import { OpenAIProvider } from './openai.ts'

export class HpcAiProvider extends OpenAIProvider {
    public override id = 'hpc-ai'

    constructor(apiKey?: string) {
        super('https://api.hpc-ai.com/inference/v1', apiKey || process.env.HPC_AI_API_KEY)
    }
}
