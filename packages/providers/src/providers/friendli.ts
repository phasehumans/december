import { OpenAIProvider } from './openai.ts'

export class FriendliProvider extends OpenAIProvider {
    public override id = 'friendli'

    constructor(apiKey?: string) {
        super('https://api.friendli.ai/serverless/v1', apiKey || process.env.FRIENDLI_TOKEN)
    }
}
