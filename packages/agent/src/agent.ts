import { Message, Tool, AgentHooks } from './types'
import { LLMProvider } from '@december/providers'
import { SessionRepository } from './harness/session-repository'

import { AgentOperations } from './operations'

export interface AgentConfig {
    sessionId?: string
    systemPrompt?: string
    tools: Tool[]
    llm: LLMProvider
    operations: AgentOperations
    modelOptions?: Record<string, any>
    sessionRepository?: SessionRepository
    hooks?: AgentHooks
}

export class Agent {
    public messages: Message[] = []
    public tools: Map<string, Tool> = new Map()
    public systemPrompt: string
    public llm: LLMProvider
    public sessionId: string
    public sessionRepository?: SessionRepository
    public hooks?: AgentHooks
    public operations: AgentOperations
    public env: Map<string, string>
    public modelOptions?: Record<string, any>

    constructor(config: AgentConfig) {
        this.llm = config.llm
        this.systemPrompt = config.systemPrompt || 'You are a helpful autonomous software engineer.'
        this.sessionId = config.sessionId || 'default'
        this.sessionRepository = config.sessionRepository
        this.hooks = config.hooks
        this.operations = config.operations
        this.env = new Map<string, string>()
        this.modelOptions = config.modelOptions

        for (const tool of config.tools) {
            this.tools.set(tool.name, tool)
        }

        // Initialize with system prompt
        this.messages.push({
            role: 'system',
            content: this.systemPrompt,
        })
    }

    public setLLM(llm: LLMProvider) {
        this.llm = llm
    }

    public addMessage(message: Message) {
        this.messages.push(message)
    }

    public async saveContext() {
        if (this.sessionRepository) {
            await this.sessionRepository.saveContext(this.sessionId, this.messages)
        }
    }

    public async loadContext(sessionId?: string) {
        if (sessionId) this.sessionId = sessionId
        if (this.sessionRepository) {
            this.messages = await this.sessionRepository.loadContext(this.sessionId)
        }
    }
}
