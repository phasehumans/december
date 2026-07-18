import { Agent } from './agent'
import { runAgentLoop } from './agent-loop'

export interface RpcProxyContext {
    onMessage: (message: string) => void
    sendEvent: (event: string) => void
}

export class EventStreamingProxy {
    private agent: Agent

    constructor(agent: Agent) {
        this.agent = agent
    }

    /**
     * executes the agent loop and serializes all events to a callback.
     * this allows a websocket or rpc layer to easily forward the agent's thought process
     * to a remote web ui.
     */
    public async run(userInput: string, rpc: RpcProxyContext): Promise<void> {
        const generator = runAgentLoop(this.agent, userInput)

        for await (const event of generator) {
            // serialize and send the event to the connected client
            rpc.sendEvent(JSON.stringify(event))
        }
    }
}
