import { OpenAIProvider } from './openai.ts'

export class RoutingRunProvider extends OpenAIProvider {
    public override id = 'routing-run'

    constructor(apiKey?: string) {
        super('https://api.routing.run/v1', apiKey || process.env.ROUTING_RUN_API_KEY)
    }
}
