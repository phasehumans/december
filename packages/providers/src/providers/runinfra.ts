import { OpenAIProvider } from './openai.ts'

export class RuninfraProvider extends OpenAIProvider {
    public override id = 'runinfra'

    constructor(apiKey?: string) {
        super('https://api.runinfra.ai/v1', apiKey || process.env.RUNINFRA_GATEWAY_KEY)
    }
}
