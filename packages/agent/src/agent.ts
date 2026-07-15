import type { LLMProvider } from '@december/providers'
import type { AgentMessage, Message, Tool, AgentHooks } from '@december/shared'

import type { SessionRepository } from './harness/session-repository'
import type { PlatformAdapter } from './platform-adapter'
import { ConversationManager } from './conversation-manager'

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
    thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high'
    steeringMode?: 'all' | 'one-at-a-time'
    followUpMode?: 'all' | 'one-at-a-time'
}

class PendingMessageQueue {
    private queue: AgentMessage[] = []
    public mode: 'all' | 'one-at-a-time'

    constructor(mode: 'all' | 'one-at-a-time') {
        this.mode = mode
    }

    push(msg: AgentMessage) {
        this.queue.push(msg)
    }

    get length() {
        return this.queue.length
    }

    drain(): AgentMessage[] {
        if (this.mode === 'all') {
            const drained = this.queue.slice()
            this.queue = []
            return drained
        }
        if (this.queue.length > 0) {
            return [this.queue.shift()!]
        }
        return []
    }
}

export class Agent {
    public conversation: ConversationManager
    public tools: Map<string, Tool> = new Map()
    public systemPrompt: string
    public llm: LLMProvider
    public sessionId: string
    public sessionRepository?: SessionRepository
    public hooks?: AgentHooks
    public operations: PlatformAdapter
    public env: Map<string, string>
    public modelOptions?: Record<string, any>
    public thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high'
    public steeringQueue: PendingMessageQueue
    public followUpQueue: PendingMessageQueue
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
        this.thinkingLevel = config.thinkingLevel || 'off'
        this.convertToLlm = config.convertToLlm || this.defaultConvertToLlm
        this.steeringQueue = new PendingMessageQueue(config.steeringMode || 'one-at-a-time')
        this.followUpQueue = new PendingMessageQueue(config.followUpMode || 'one-at-a-time')
        this.conversation = new ConversationManager()

        for (const tool of config.tools) {
            this.tools.set(tool.name, tool)
        }

        // Initialize with system prompt
        this.conversation.addMessage({
            role: 'system',
            content: this.systemPrompt,
        })
    }

    get messages(): AgentMessage[] {
        return this.conversation.messages
    }

    set messages(msgs: AgentMessage[]) {
        this.conversation.messages = msgs
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
            this.messages = [this.messages[0]!]
            await this.saveContext()
        }
    }

    public async compactContext() {
        if (this.messages.length > 8) {
            const systemPrompt = this.messages[0]
            const toSummarize = this.messages.slice(1, -5)
            const recentMessages = this.messages.slice(-5)

            const summaryPrompt =
                `Summarize the following past events in this session. Keep it extremely concise but retain all key facts, file paths, and current goals:\n` +
                JSON.stringify(toSummarize)

            let summaryContent = '[System: Conversation compacted]'
            try {
                // Collect stream from llm
                const stream = this.llm.stream(
                    [{ role: 'user', content: summaryPrompt }],
                    [], // no tools
                    '', // no system prompt
                    this.modelOptions,
                    new AbortController().signal
                )
                let text = ''
                for await (const chunk of stream) {
                    if (chunk.type === 'text') text += chunk.text
                }
                summaryContent = `[System: Conversation compacted. Earlier events summary: ${text}]`
            } catch (e) {
                console.error('Failed to generate summary for context compaction:', e)
            }

            this.messages = [
                systemPrompt!,
                {
                    role: 'system',
                    content: summaryContent,
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
            this.messages = [this.messages[0]!]
        }
        await this.saveContext()
    }

    public async forkContext(newSessionId?: string) {
        this.sessionId = newSessionId || `session-${Date.now()}`
        await this.saveContext()
        return this.sessionId
    }
}
