import { LLMProvider } from '@december/providers'
import { AgentMessage, Message, Tool, AgentHooks } from '@december/shared'

import { SessionRepository } from './harness/session-repository'
import { PlatformAdapter } from './platform-adapter'

export interface AgentConfig {
    sessionId?: string
    systemPrompt?: string
    tools: Tool[]
    llm: LLMProvider
    operations: PlatformAdapter
    modelOptions?: Record<string, any>
    sessionRepository?: SessionRepository
    hooks?: AgentHooks
    convertToLlm?: (messages: AgentMessage[]) => Message[]
}

export class Agent {
    public messages: AgentMessage[] = []
    public tools: Map<string, Tool> = new Map()
    public systemPrompt: string
    public llm: LLMProvider
    public sessionId: string
    public sessionRepository?: SessionRepository
    public hooks?: AgentHooks
    public operations: PlatformAdapter
    public env: Map<string, string>
    public modelOptions?: Record<string, any>
    public steeringQueue: AgentMessage[] = []
    public followUpQueue: AgentMessage[] = []
    public activeAbortController?: AbortController
    public convertToLlm: (messages: AgentMessage[]) => Message[]

    constructor(config: AgentConfig) {
        this.llm = config.llm
        this.systemPrompt = config.systemPrompt || 'You are a helpful autonomous software engineer.'
        this.sessionId = config.sessionId || 'default'
        this.sessionRepository = config.sessionRepository
        this.hooks = config.hooks
        this.operations = config.operations
        this.env = new Map<string, string>()
        this.modelOptions = config.modelOptions
        this.convertToLlm = config.convertToLlm || this.defaultConvertToLlm

        for (const tool of config.tools) {
            this.tools.set(tool.name, tool)
        }

        // Initialize with system prompt
        this.messages.push({
            role: 'system',
            content: this.systemPrompt,
        })
    }

    private defaultConvertToLlm(messages: AgentMessage[]): Message[] {
        return messages
            .filter((m) => !m.isUI)
            .map((m) => ({
                role: m.role,
                content: m.content,
                toolCalls: m.toolCalls,
                toolCallId: m.toolCallId,
            }))
    }

    public steer(message: AgentMessage) {
        this.steeringQueue.push(message)
    }

    public followUp(message: AgentMessage) {
        this.followUpQueue.push(message)
    }

    public abort() {
        if (this.activeAbortController) {
            this.activeAbortController.abort()
        }
    }

    public setLLM(llm: LLMProvider) {
        this.llm = llm
    }

    public addMessage(message: AgentMessage) {
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
            const loaded = await this.sessionRepository.loadContext(this.sessionId)
            if (loaded.length > 0) {
                this.messages = loaded
            }
            // If empty, keep the constructor's messages (system prompt)
        }
    }

    public async clearContext() {
        if (this.messages.length > 0) {
            this.messages = [this.messages[0]]
            await this.saveContext()
        }
    }

    public async compactContext() {
        if (this.messages.length > 6) {
            const systemPrompt = this.messages[0]
            const recentMessages = this.messages.slice(-5)
            this.messages = [
                systemPrompt,
                {
                    role: 'system',
                    content: '[System: Conversation compacted to save context window]',
                    isUI: true,
                },
                ...recentMessages,
            ]
            await this.saveContext()
        }
    }

    public async newContext() {
        this.sessionId = `session-${Date.now()}`
        if (this.messages.length > 0) {
            this.messages = [this.messages[0]]
        }
        await this.saveContext()
    }

    public async forkContext(newSessionId?: string) {
        this.sessionId = newSessionId || `session-${Date.now()}`
        await this.saveContext()
        return this.sessionId
    }
}
