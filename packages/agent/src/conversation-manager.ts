import { v4 as uuidv4 } from 'uuid'

import {
    compactContextIfNeeded,
    estimateTokens,
    pruneToolResults,
    type CompactionOptions,
} from './utils/compaction'

import type { LLMProvider } from '@december/providers'
import type { AgentMessage } from '@december/shared'

export const MAX_WORKSPACE_MEMORY_BYTES = 2048 // Strict 2KB budget for cloud pinned rules

/**
 * Safely truncates a UTF-8 string to a maximum byte length without splitting multi-byte characters.
 */
export function truncateUtf8ByBytes(str: string, maxBytes: number): string {
    const buf = Buffer.from(str, 'utf8')
    if (buf.length <= maxBytes) return str

    let end = maxBytes
    // In UTF-8, continuation bytes have the pattern 10xxxxxx (0x80 to 0xBF)
    while (end > 0 && (buf[end]! & 0xc0) === 0x80) {
        end--
    }

    if (end > 0) {
        const lead = buf[end]!
        let seqLen = 1
        if ((lead & 0xe0) === 0xc0) seqLen = 2
        else if ((lead & 0xf0) === 0xe0) seqLen = 3
        else if ((lead & 0xf8) === 0xf0) seqLen = 4

        if (end + seqLen > maxBytes) {
            // Sequence overflows maxBytes: exclude this partial lead byte
        } else {
            end += seqLen
        }
    }

    return buf.subarray(0, end).toString('utf8')
}

export interface ConversationManagerOptions {
    workspaceRoot?: string
    systemPrompt?: string
    pinnedRules?: string
    maxMemoryBytes?: number
}

export class ConversationManager {
    private _messages: AgentMessage[] = []
    public workspaceRoot?: string
    public pinnedRules?: string
    public maxMemoryBytes: number = MAX_WORKSPACE_MEMORY_BYTES

    constructor(
        initialMessagesOrOptions?: AgentMessage[] | ConversationManagerOptions,
        options?: ConversationManagerOptions
    ) {
        let initialMessages: AgentMessage[] = []
        let opts: ConversationManagerOptions | undefined

        if (Array.isArray(initialMessagesOrOptions)) {
            initialMessages = initialMessagesOrOptions
            opts = options
        } else if (initialMessagesOrOptions && typeof initialMessagesOrOptions === 'object') {
            opts = initialMessagesOrOptions
        }

        this._messages = initialMessages

        if (opts?.pinnedRules) {
            this.pinnedRules = opts.pinnedRules
        }
        if (opts?.maxMemoryBytes) {
            this.maxMemoryBytes = opts.maxMemoryBytes
        }

        if (opts?.workspaceRoot || opts?.pinnedRules) {
            this.workspaceRoot = opts.workspaceRoot
            this.initSession({
                workspaceRoot: opts.workspaceRoot,
                systemPrompt: opts.systemPrompt,
                pinnedRules: opts.pinnedRules,
                maxMemoryBytes: opts.maxMemoryBytes,
            })
        }
    }

    public initSession(
        optionsOrWorkspaceRoot?:
            | string
            | {
                  workspaceRoot?: string
                  systemPrompt?: string
                  pinnedRules?: string
                  maxMemoryBytes?: number
              },
        systemPromptArg?: string
    ): string {
        let workspaceRoot: string | undefined
        let systemPrompt: string | undefined
        let pinnedRules: string | undefined
        let maxMemoryBytes: number | undefined

        if (typeof optionsOrWorkspaceRoot === 'string') {
            workspaceRoot = optionsOrWorkspaceRoot
            systemPrompt = systemPromptArg
        } else if (optionsOrWorkspaceRoot && typeof optionsOrWorkspaceRoot === 'object') {
            workspaceRoot = optionsOrWorkspaceRoot.workspaceRoot
            systemPrompt = optionsOrWorkspaceRoot.systemPrompt
            pinnedRules = optionsOrWorkspaceRoot.pinnedRules
            maxMemoryBytes = optionsOrWorkspaceRoot.maxMemoryBytes
        } else {
            workspaceRoot = this.workspaceRoot
            systemPrompt = systemPromptArg
        }

        if (workspaceRoot) {
            this.workspaceRoot = workspaceRoot
        }
        if (pinnedRules) {
            this.pinnedRules = pinnedRules
        }
        if (maxMemoryBytes) {
            this.maxMemoryBytes = maxMemoryBytes
        }

        const existingSystemIndex = this._messages.findIndex((m) => m.role === 'system')
        let prompt = systemPrompt
        if (prompt === undefined) {
            if (existingSystemIndex !== -1) {
                prompt = this._messages[existingSystemIndex]!.content
            } else {
                prompt = ''
            }
        }

        const memoryContent = this.readPinnedRules()

        let finalPrompt = prompt
        if (memoryContent) {
            finalPrompt = this.injectMemoryBlock(prompt, memoryContent)
        }

        if (existingSystemIndex !== -1) {
            this._messages[existingSystemIndex]!.content = finalPrompt
        } else if (finalPrompt) {
            this._messages.unshift({
                role: 'system',
                content: finalPrompt,
                id: uuidv4(),
                timestamp: Date.now(),
            })
        }

        return finalPrompt
    }

    /**
     * Cloud pinned rules (project setting). Workspace rule files (AGENTS.md / CLAUDE.md)
     * are loaded by the agent harness through discoverProjectRules, not here.
     */
    private readPinnedRules(): string {
        let combined = (this.pinnedRules || '').trim()
        if (Buffer.byteLength(combined, 'utf8') > this.maxMemoryBytes) {
            const limit = Math.max(0, this.maxMemoryBytes - 32)
            const truncated = truncateUtf8ByBytes(combined, limit)
            combined = `${truncated}\n... [truncated to 2KB budget]`
        }

        return combined
    }

    private injectMemoryBlock(prompt: string, memoryContent: string): string {
        if (!memoryContent.trim()) return prompt
        if (prompt.includes('<project_memory>')) return prompt

        let content = memoryContent.trim()
        if (Buffer.byteLength(content, 'utf8') > this.maxMemoryBytes) {
            const limit = Math.max(0, this.maxMemoryBytes - 32)
            const truncated = truncateUtf8ByBytes(content, limit)
            content = `${truncated}\n... [truncated to 2KB budget]`
        }

        const block = `<project_memory>\n${content}\n</project_memory>`

        if (!prompt) return block

        if (prompt.includes('\n\nCurrent date:')) {
            return prompt.replace('\n\nCurrent date:', `\n\n${block}\n\nCurrent date:`)
        }

        return `${prompt}\n\n${block}`
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

    /** Removes the message with the given id and every message after it. */
    public truncateBeforeMessage(messageId: string): boolean {
        const cutIndex = this._messages.findIndex((m) => m.id === messageId)
        if (cutIndex === -1) return false
        this._messages = this._messages.slice(0, cutIndex)
        return true
    }

    async compactIfNeeded(
        llm: LLMProvider,
        maxTokens?: number,
        modelOptions?: Record<string, any>,
        signal?: AbortSignal,
        options?: CompactionOptions
    ): Promise<CompactResult> {
        const tokensBefore = estimateTokens(this._messages as any)

        // Tier 1: Zero-LLM Tool Result Pruning
        const pruneResult = pruneToolResults(this._messages)

        const originalLength = this._messages.length

        // Tier 2: LLM Context Summarization
        // Compacts when context window reaches >= 80% capacity (or if explicit maxTurns is configured)
        const effectiveOptions: CompactionOptions = {
            maxTurns: options?.maxTurns,
            minTokens: options?.minTokens,
            onStatus: options?.onStatus,
            force: options?.force,
            focus: options?.focus,
        }

        const newMessages = (await compactContextIfNeeded(
            this._messages as any,
            llm,
            maxTokens,
            modelOptions,
            signal,
            effectiveOptions
        )) as AgentMessage[]

        if (newMessages.length < originalLength) {
            this._messages = newMessages
            const summaryMsg = newMessages[1]
            return {
                compacted: true,
                summary: summaryMsg?.content || '',
                pruned: pruneResult.pruned,
                tokensSaved: pruneResult.tokensSaved,
                tokensBefore,
                tokensAfter: estimateTokens(this._messages as any),
            }
        }

        if (pruneResult.pruned) {
            return {
                compacted: true,
                summary: `Pruned old tool results, saving ~${pruneResult.tokensSaved} tokens.`,
                pruned: true,
                tokensSaved: pruneResult.tokensSaved,
                tokensBefore,
                tokensAfter: estimateTokens(this._messages as any),
            }
        }

        return { compacted: false, tokensBefore, tokensAfter: tokensBefore }
    }
}

export interface CompactResult {
    compacted: boolean
    summary?: string
    pruned?: boolean
    tokensSaved?: number
    /** estimated tokens of the conversation before and after compaction */
    tokensBefore?: number
    tokensAfter?: number
}
