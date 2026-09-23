import { OpenAIProvider } from './openai.ts'

export class ModelscopeProvider extends OpenAIProvider {
    public override id = 'modelscope'

    constructor(apiKey?: string) {
        super('https://api-inference.modelscope.cn/v1', apiKey || process.env.MODELSCOPE_API_KEY)
    }
}
