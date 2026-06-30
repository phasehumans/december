import { Message, Tool } from './types'
import { LLMProvider } from './llm'

export interface AgentConfig {
    systemPrompt?: string
    tools: Tool[]
    llm: LLMProvider
}

export class Agent {
    public messages: Message[] = []
    public tools: Map<string, Tool> = new Map()
    public systemPrompt: string
    public llm: LLMProvider

    constructor(config: AgentConfig) {
        this.llm = config.llm
        this.systemPrompt = config.systemPrompt || 'You are a helpful autonomous software engineer.'
        for (const tool of config.tools) {
            this.tools.set(tool.name, tool)
        }

        // Initialize with system prompt
        this.messages.push({
            role: 'system',
            content: this.systemPrompt,
        })
    }

    public addMessage(message: Message) {
        this.messages.push(message)
    }
}
