import { OpenAIProvider } from './openai.ts'

export class ModalProvider extends OpenAIProvider {
    public override id = 'modal'

    constructor(apiKey?: string) {
        super('https://inference.us-west.modal.direct/v1', apiKey || process.env.MODAL_PROXY_TOKEN)
    }
}
