import { compactContextIfNeeded } from './utils/compaction'
import type { AgentMessage } from '@december/shared'
import type { LLMProvider } from '@december/providers'

export class ConversationManager {
    private _messages: AgentMessage[] = []

    constructor(initialMessages: AgentMessage[] = []) {
        this._messages = initialMessages
    }

    get messages(): AgentMessage[] {
        return this._messages
    }

    set messages(msgs: AgentMessage[]) {
        this._messages = msgs
    }

    addMessage(msg: AgentMessage) {
        if (!msg.id) msg.id = require('uuid').v4()
        if (msg.parentId === undefined) {
            const parent = this._messages[this._messages.length - 1]
            msg.parentId = parent ? parent.id : undefined
        }
        msg.timestamp = msg.timestamp || Date.now()
        this._messages.push(msg)
    }

    async compactIfNeeded(
        llm: LLMProvider,
        maxTokens?: number,
        modelOptions?: Record<string, any>
    ): Promise<{ compacted: boolean; summary?: string }> {
        const originalLength = this._messages.length

        // compactContextIfNeeded will execute only if token count > maxTokens * 0.8
        const newMessages = (await compactContextIfNeeded(
            this._messages as any,
            llm,
            maxTokens,
            modelOptions
        )) as AgentMessage[]

        if (newMessages.length < originalLength) {
            this._messages = newMessages
            // The summary is typically the second message (index 1) in the compacted format
            const summaryMsg = newMessages[1]
            return { compacted: true, summary: summaryMsg?.content || '' }
        }

        return { compacted: false }
    }
}
