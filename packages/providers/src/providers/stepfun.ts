import { OpenAIProvider } from './openai.ts'

export class StepFunProvider extends OpenAIProvider {
    public override id = 'stepfun'

    constructor(apiKey?: string) {
        super('https://api.stepfun.ai/v1', apiKey || process.env.STEPFUN_API_KEY)
    }
}
