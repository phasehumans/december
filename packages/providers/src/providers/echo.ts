import { OpenAIProvider } from './openai.ts'

export class EchoProvider extends OpenAIProvider {
    public override id = 'echo'

    constructor(apiKey?: string) {
        super('https://echo.tracerml.ai/v1', apiKey || process.env.ECHO_API_KEY)
    }
}
