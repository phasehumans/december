import { AgentEvent } from './types'
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
     * Executes the agent loop and serializes all events to a callback.
     * This allows a WebSocket or RPC layer to easily forward the agent's thought process
     * to a remote Web UI.
     */
    public async run(userInput: string, rpc: RpcProxyContext): Promise<void> {
        const generator = runAgentLoop(this.agent, userInput)

        for await (const event of generator) {
            // Serialize and send the event to the connected client
            rpc.sendEvent(JSON.stringify(event))
        }
    }
}
