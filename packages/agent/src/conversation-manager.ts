import fs from 'node:fs'
import path from 'node:path'

import { v4 as uuidv4 } from 'uuid'

import { compactContextIfNeeded, pruneToolResults } from './utils/compaction'

import type { LLMProvider } from '@december/providers'
import type { AgentMessage } from '@december/shared'

export interface ConversationManagerOptions {
    workspaceRoot?: string
    systemPrompt?: string
}

export class ConversationManager {
    private _messages: AgentMessage[] = []
    public workspaceRoot?: string

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

        if (opts?.workspaceRoot) {
            this.workspaceRoot = opts.workspaceRoot
            this.initSession({
                workspaceRoot: opts.workspaceRoot,
                systemPrompt: opts.systemPrompt,
            })
        }
    }

    public initSession(
        optionsOrWorkspaceRoot?: string | { workspaceRoot?: string; systemPrompt?: string },
        systemPromptArg?: string
    ): string {
        let workspaceRoot: string | undefined
        let systemPrompt: string | undefined

        if (typeof optionsOrWorkspaceRoot === 'string') {
            workspaceRoot = optionsOrWorkspaceRoot
            systemPrompt = systemPromptArg
        } else if (optionsOrWorkspaceRoot && typeof optionsOrWorkspaceRoot === 'object') {
            workspaceRoot = optionsOrWorkspaceRoot.workspaceRoot
            systemPrompt = optionsOrWorkspaceRoot.systemPrompt
        } else {
            workspaceRoot = this.workspaceRoot
            systemPrompt = systemPromptArg
        }

        if (workspaceRoot) {
            this.workspaceRoot = workspaceRoot
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

        const memoryContent = this.readWorkspaceMemory(workspaceRoot)

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

    private readWorkspaceMemory(workspaceRoot?: string): string {
        if (!workspaceRoot) return ''

        const memoryCandidates = [
            path.join(workspaceRoot, '.december', 'memory.md'),
            path.join(workspaceRoot, 'MEMORY.md'),
            path.join(workspaceRoot, '.december', 'MEMORY.md'),
            path.join(workspaceRoot, 'memory.md'),
        ]

        const rulesCandidates = [
            path.join(workspaceRoot, 'RULES.md'),
            path.join(workspaceRoot, '.december', 'rules.md'),
            path.join(workspaceRoot, '.december', 'RULES.md'),
            path.join(workspaceRoot, 'rules.md'),
        ]

        let memoryText = ''
        for (const candidate of memoryCandidates) {
            try {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    const content = fs.readFileSync(candidate, 'utf8').trim()
                    if (content) {
                        memoryText = content
                        break
                    }
                }
            } catch {
                // Intentionally swallowed: missing or unreadable workspace memory file handled gracefully
            }
        }

        let rulesText = ''
        for (const candidate of rulesCandidates) {
            try {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    const content = fs.readFileSync(candidate, 'utf8').trim()
                    if (content) {
                        rulesText = content
                        break
                    }
                }
            } catch {
                // Intentionally swallowed: missing or unreadable workspace rules file handled gracefully
            }
        }

        const parts: string[] = []
        if (memoryText) parts.push(memoryText)
        if (rulesText && rulesText !== memoryText) parts.push(rulesText)

        return parts.join('\n\n').trim()
    }

    private injectMemoryBlock(prompt: string, memoryContent: string): string {
        if (!memoryContent.trim()) return prompt
        if (prompt.includes('<project_memory>')) return prompt

        const block = `<project_memory>\n${memoryContent.trim()}\n</project_memory>`

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
