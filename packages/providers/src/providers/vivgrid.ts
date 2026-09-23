import { OpenAIProvider } from './openai.ts'

export class VivgridProvider extends OpenAIProvider {
    public override id = 'vivgrid'

    constructor(apiKey?: string) {
        super('https://api.vivgrid.com/v1', apiKey || process.env.VIVGRID_API_KEY)
    }
}
