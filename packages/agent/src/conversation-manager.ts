import { v4 as uuidv4 } from 'uuid'

import { compactContextIfNeeded } from './utils/compaction'

import type { LLMProvider } from '@december/providers'
import type { AgentMessage } from '@december/shared'

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
        if (!msg.id) msg.id = uuidv4()
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

        // token > max * 0.8 (80% limit)
        const newMessages = (await compactContextIfNeeded(
            this._messages as any,
            llm,
            maxTokens,
            modelOptions
        )) as AgentMessage[]

        if (newMessages.length < originalLength) {
            this._messages = newMessages
            const summaryMsg = newMessages[1]
            return { compacted: true, summary: summaryMsg?.content || '' }
        }

        return { compacted: false }
    }
}
