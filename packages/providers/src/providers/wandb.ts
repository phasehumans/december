import { OpenAIProvider } from './openai.ts'

export class WandbProvider extends OpenAIProvider {
    public override id = 'wandb'

    constructor(apiKey?: string) {
        super('https://api.inference.wandb.ai/v1', apiKey || process.env.WANDB_API_KEY)
    }
}
