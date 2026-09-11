import { v4 as uuidv4 } from 'uuid'

import { compactContextIfNeeded, pruneToolResults } from './utils/compaction'

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
        modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ): Promise<{ compacted: boolean; summary?: string; pruned?: boolean; tokensSaved?: number }> {
        // Tier 1: Zero-LLM Tool Result Pruning
        const pruneResult = pruneToolResults(this._messages)

        const originalLength = this._messages.length

        // Tier 2: LLM Context Summarization
        const newMessages = (await compactContextIfNeeded(
            this._messages as any,
            llm,
            maxTokens,
            modelOptions,
            signal
        )) as AgentMessage[]

        if (newMessages.length < originalLength) {
            this._messages = newMessages
            const summaryMsg = newMessages[1]
            return {
                compacted: true,
                summary: summaryMsg?.content || '',
                pruned: pruneResult.pruned,
                tokensSaved: pruneResult.tokensSaved,
            }
        }

        if (pruneResult.pruned) {
            return {
                compacted: true,
                summary: `Pruned old tool results, saving ~${pruneResult.tokensSaved} tokens.`,
                pruned: true,
                tokensSaved: pruneResult.tokensSaved,
            }
        }

        return { compacted: false }
    }
}
