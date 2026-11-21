import {
    DeferredToolRegistry,
    type DeferredToolMetadata,
    type McpClientManager,
    type McpServerConfig,
} from '@december/tools'

import { ConversationManager, type CompactResult } from './conversation-manager'
import {
    deriveTitleFromPrompt,
    generateSessionTitle,
    normalizeSessionTitle,
    type SessionTitleSource,
} from './session-title'
import { createAgentTracer } from './telemetry/tracer.factory'
import { evaporateStaleToolOutputs } from './utils/evaporation'

import type { SessionRepository } from './harness/session-repository'
import type { PlatformAdapter } from './platform-adapter'
import type { AgentTracer } from './telemetry/tracer.types'
import type { LLMProvider } from '@december/providers'
import type { AgentMessage, Message, Tool, AgentHooks } from '@december/shared'
import type { SnapshotRecord } from '@december/tools'

export interface AgentConfig {
    sessionId?: string
    userId?: string
    runtime?: 'cloud' | 'cli'
    systemPrompt?: string
    tools: Tool[]
    deferredTools?: Tool[]
    deferredRegistry?: DeferredToolRegistry
    mcpClientManager?: McpClientManager
    llm: LLMProvider
    operations: PlatformAdapter
    modelOptions?: Record<string, any>
    sessionRepository?: SessionRepository
    hooks?: AgentHooks
    convertToLlm?: (messages: AgentMessage[]) => Message[]
    thinkingLevel?: 'fast' | 'deep' | 'off' | string
    steeringMode?: 'all' | 'one-at-a-time'
    followUpMode?: 'all' | 'one-at-a-time'
    workspaceDir?: string
    logsDir?: string
    disableLogging?: boolean
    tracer?: AgentTracer
    depth?: number
    maxDepth?: number
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

export function sanitizeSessionId(rawName: string): string {
    const cleaned = rawName
        .trim()
        .replace(/[\\/:\*\?"<>\|]/g, '-')
        .replace(/\.+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
    return cleaned || `session-${Date.now()}`
}

export class Agent {
    public conversation: ConversationManager
    public tools: Map<string, Tool> = new Map()
    public systemPrompt: string
    public llm: LLMProvider
    public sessionId: string
    public sessionTitle?: string
    public sessionTitleSource?: SessionTitleSource
    public sessionRepository?: SessionRepository
    public hooks?: AgentHooks
    public operations: PlatformAdapter
    public env: Map<string, string>
    public modelOptions?: Record<string, any>
    public thinkingLevel?: 'fast' | 'deep' | 'off' | string
    public steeringQueue: PendingMessageQueue
    public followUpQueue: PendingMessageQueue
    public activeAbortController?: AbortController
    public convertToLlm: (messages: AgentMessage[]) => Message[]
    public workspaceDir?: string
    public logsDir?: string
    public disableLogging: boolean
    public tracer: AgentTracer
    public deferredRegistry: DeferredToolRegistry
    public mcpClientManager?: McpClientManager
    public depth: number
    public maxDepth: number
    private titleUpgradeAttempted = new Set<string>()

    constructor(config: AgentConfig) {
        this.depth = config.depth ?? 0
        this.maxDepth = config.maxDepth ?? 5
        this.llm = config.llm
        this.systemPrompt = config.systemPrompt || 'You are a helpful coding agent.'
        this.sessionId = config.sessionId || 'default'
        this.sessionRepository = config.sessionRepository
        this.hooks = config.hooks
        this.operations = config.operations
        this.env = new Map<string, string>()
        this.modelOptions = config.modelOptions
        this.thinkingLevel = config.thinkingLevel || 'fast'
        this.convertToLlm = config.convertToLlm || this.defaultConvertToLlm
        this.steeringQueue = new PendingMessageQueue(config.steeringMode || 'all')
        this.followUpQueue = new PendingMessageQueue(config.followUpMode || 'all')
        this.workspaceDir = config.workspaceDir
        this.conversation = new ConversationManager([], {
            workspaceRoot: config.workspaceDir,
        })
        this.systemPrompt = this.conversation.initSession({
            workspaceRoot: config.workspaceDir,
            systemPrompt: this.systemPrompt,
        })
        this.logsDir = config.logsDir
        this.disableLogging = config.disableLogging || false
        this.deferredRegistry = config.deferredRegistry || new DeferredToolRegistry()
        this.mcpClientManager = config.mcpClientManager
        if (this.mcpClientManager) {
            this.mcpClientManager.setRegistry(this.deferredRegistry)
        }
        this.tracer =
            config.tracer ||
            createAgentTracer({
                runtime: config.runtime || 'cli',
                sessionId: this.sessionId,
                userId: config.userId,
                workspaceDir: config.workspaceDir,
            })

        for (const tool of config.tools) {
            this.tools.set(tool.name, tool)
        }

        if (config.deferredTools) {
            for (const tool of config.deferredTools) {
                this.deferredRegistry.register(tool)
            }
        }

        if (this.conversation.messages.length === 0) {
            this.conversation.addMessage({
                role: 'system',
                content: this.systemPrompt,
            })
        }
    }

    get messages(): AgentMessage[] {
        return this.conversation.messages
    }

    set messages(msgs: AgentMessage[]) {
        this.conversation.messages = msgs
    }

    private defaultConvertToLlm(messages: AgentMessage[]): Message[] {
        const filtered = messages.filter((m) => !m.isUI)
        const evaporated = evaporateStaleToolOutputs(filtered, {
            preserveRecentTurns: 3,
            preserveRecentSteps: 2,
            maxOutputSize: 6 * 1024,
        })

        // Merge adjacent user messages to preserve alternating dialogue format and prevent provider errors
        const merged: Message[] = []
        for (let i = 0; i < evaporated.length; i++) {
            const msg = evaporated[i]!
            let role = msg.role
            const content = msg.content

            // Prevent illegal mid-conversation system roles for providers like Anthropic
            if (role === 'system' && i > 0 && content.includes('[COMPACTED HISTORY SUMMARY]')) {
                role = 'user'
            }

            const prev = merged[merged.length - 1]
            if (
                prev &&
                prev.role === 'user' &&
                role === 'user' &&
                !prev.toolCalls &&
                !msg.toolCalls
            ) {
                prev.content = `${prev.content}\n\n${content}`
            } else {
                merged.push({ ...msg, role, content })
            }
        }
        return merged
    }

    public steer(message: AgentMessage) {
        this.steeringQueue.push(message)
    }

    public followUp(message: AgentMessage) {
        this.followUpQueue.push(message)
    }

    public registerTool(tool: Tool): void {
        this.tools.set(tool.name, tool)
    }

    public unregisterTool(toolName: string): void {
        this.tools.delete(toolName)
    }

    private getMcpServerPrefix(serverName: string): string {
        const cleanServer = serverName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '')
        return `mcp_${cleanServer}_`
    }

    public unregisterMcpServerTools(serverName: string): void {
        const prefix = this.getMcpServerPrefix(serverName)
        for (const name of Array.from(this.tools.keys())) {
            if (name.startsWith(prefix)) {
                this.tools.delete(name)
            }
        }
        for (const tool of this.deferredRegistry.getAll()) {
            if (tool.name.startsWith(prefix)) {
                this.deferredRegistry.unregister(tool.name)
            }
        }
    }

    public registerMcpServerTools(serverName: string): void {
        if (!this.mcpClientManager) return
        const prefix = this.getMcpServerPrefix(serverName)
        for (const tool of this.mcpClientManager.getEagerTools()) {
            if (tool.name.startsWith(prefix)) {
                this.registerTool(tool)
            }
        }
    }

    public registerDeferredTool(tool: Tool, metadata?: DeferredToolMetadata): void {
        this.deferredRegistry.register(tool, metadata)
    }

    private onToolActivated?: (tool: Tool) => void

    public setOnToolActivated(cb: (tool: Tool) => void): void {
        this.onToolActivated = cb
    }

    public getTools(): Tool[] {
        return Array.from(this.tools.values())
    }

    public setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt
        if (
            this.conversation.messages.length > 0 &&
            this.conversation.messages[0]?.role === 'system'
        ) {
            this.conversation.messages[0].content = prompt
        }
    }

    public updateModel(model: string, thinkingLevel?: string): void {
        this.modelOptions = {
            ...this.modelOptions,
            model,
            ...(thinkingLevel !== undefined ? { thinkingLevel } : {}),
        }
        if (thinkingLevel !== undefined) {
            this.thinkingLevel = thinkingLevel as any
        }
    }

    public activateDeferredTool(toolName: string): boolean {
        const tool = this.deferredRegistry.get(toolName)
        if (tool) {
            this.tools.set(tool.name, tool)
            this.onToolActivated?.(tool)
            return true
        }
        return false
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
        this.conversation.addMessage(message)
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
        }
        await this.loadSessionTitle()
    }

    /**
     * Compacts the conversation now (/compact), without waiting for the context threshold.
     * `focus` is added to the summary instructions. The result is saved to the session.
     */
    public async compact(options?: {
        focus?: string
        onStatus?: (status: string) => void
    }): Promise<CompactResult> {
        // abort() (esc in the tui) cancels the summary request
        const abortController = new AbortController()
        this.activeAbortController = abortController
        try {
            const result = await this.conversation.compactIfNeeded(
                this.llm,
                undefined,
                this.modelOptions,
                abortController.signal,
                { force: true, focus: options?.focus, onStatus: options?.onStatus }
            )
            if (result.compacted) await this.saveContext()
            return result
        } finally {
            if (this.activeAbortController === abortController) {
                this.activeAbortController = undefined
            }
        }
    }

    public async clearContext() {
        if (this.messages.length > 0) {
            this.messages = [this.messages[0]!]
            await this.saveContext()
        }
    }

    /** makes a new internal session id that differs from the current one and any saved one */
    private async createSessionId(): Promise<string> {
        const base = `session-${Date.now()}`
        let id = base
        let counter = 1
        while (id === this.sessionId || (await this.sessionRepository?.hasSession?.(id))) {
            id = `${base}-${counter++}`
        }
        return id
    }

    public async newContext() {
        this.sessionId = await this.createSessionId()
        this.sessionTitle = undefined
        this.sessionTitleSource = undefined
        if (this.messages.length > 0) {
            this.messages = [this.messages[0]!]
        }
        await this.saveContext()
    }

    /**
     * copies the conversation into a new session. the new session always gets a
     * fresh internal id; `title` (from `/fork <title>`) becomes its display name.
     * without a title, the fork reuses the parent title with a "(fork)" suffix.
     */
    public async forkContext(title?: string) {
        const targetId = await this.createSessionId()
        const parentTitle = this.sessionTitle
        const parentSource = this.sessionTitleSource
        this.sessionId = targetId
        this.sessionTitle = undefined
        this.sessionTitleSource = undefined
        await this.saveContext()

        const requested = normalizeSessionTitle(title || '')
        if (requested) {
            await this.setSessionTitle(requested, 'manual')
        } else if (parentTitle) {
            await this.setSessionTitle(
                normalizeSessionTitle(`${parentTitle} (fork)`),
                parentSource === 'manual' ? 'manual' : 'auto'
            )
        }
        return this.sessionId
    }

    public async loadSessionTitle() {
        const meta = await this.sessionRepository?.getSessionMeta?.(this.sessionId).catch(() => {
            // Intentionally swallowed: a missing meta file means no title
            return null
        })
        this.sessionTitle = meta?.title || undefined
        this.sessionTitleSource = meta?.title ? meta.titleSource || 'manual' : undefined
    }

    /** sets and saves the display title of the current session. the session id does not change. */
    public async setSessionTitle(title: string, source: SessionTitleSource = 'manual') {
        const clean = normalizeSessionTitle(title)
        if (!clean) return
        this.sessionTitle = clean
        this.sessionTitleSource = source
        await this.sessionRepository?.setSessionMeta?.(this.sessionId, {
            title: clean,
            titleSource: source,
        })
    }

    /** gives an untitled session an instant title cut from the prompt. */
    public async ensurePromptTitle(prompt: string) {
        if (this.sessionTitle) return
        const title = deriveTitleFromPrompt(prompt)
        if (title) await this.setSessionTitle(title, 'prompt')
    }

    /** asks the model for a short title of the current conversation. empty string on failure. */
    public async generateSessionTitle(signal?: AbortSignal): Promise<string> {
        return generateSessionTitle({
            llm: this.llm,
            messages: this.messages,
            modelOptions: this.modelOptions,
            signal,
        })
    }

    /**
     * upgrades a prompt-derived title to a model-written one. it runs at most once
     * per session, never replaces a manual title, and writes to the session that
     * was active when it started (the user may run /new while it is in flight).
     */
    public async upgradeAutoTitle(): Promise<string | undefined> {
        if (this.sessionTitleSource === 'auto' || this.sessionTitleSource === 'manual') return
        const sessionId = this.sessionId
        if (this.titleUpgradeAttempted.has(sessionId)) return
        this.titleUpgradeAttempted.add(sessionId)

        const title = await this.generateSessionTitle()
        if (!title) return

        const current = await this.sessionRepository?.getSessionMeta?.(sessionId).catch(() => {
            // Intentionally swallowed: treat as untitled
            return null
        })
        if (current?.titleSource === 'manual' || current?.titleSource === 'auto') return

        await this.sessionRepository?.setSessionMeta?.(sessionId, {
            title,
            titleSource: 'auto',
        })
        if (this.sessionId === sessionId) {
            this.sessionTitle = title
            this.sessionTitleSource = 'auto'
        }
        return title
    }

    public async initMcpServers(configs?: Record<string, McpServerConfig>): Promise<void> {
        const { loadMcpConfig, McpClientManager, createReadMcpResourceTool } =
            await import('@december/tools')
        const finalConfigs = configs || (await loadMcpConfig({ workspaceDir: this.workspaceDir }))
        if (Object.keys(finalConfigs).length === 0) return

        if (!this.mcpClientManager) {
            this.mcpClientManager = new McpClientManager({
                registry: this.deferredRegistry,
                workspaceDir: this.workspaceDir,
            })
        }
        await this.mcpClientManager.connectAll(finalConfigs)

        // Register eager tools directly for immediate turn-1 availability
        for (const eagerTool of this.mcpClientManager.getEagerTools()) {
            this.registerTool(eagerTool)
        }

        // Register resource reading tool so agent can read MCP resources
        this.registerTool(createReadMcpResourceTool(this.mcpClientManager))
    }

    /**
     * Snapshots that can still be rewound in this conversation, newest first.
     * A snapshot qualifies only while the user message that started its turn is
     * still in the conversation (not removed by /clear, a new session, or compaction).
     * turnIndex is renumbered to match the turn's position in the current conversation.
     */
    public async getRewindableSnapshots(): Promise<SnapshotRecord[]> {
        const { getSnapshotManager } = await import('@december/tools')
        const snapshotManager = getSnapshotManager(this.workspaceDir)
        await snapshotManager.init()

        const turnByMessageId = new Map<string, number>()
        let turn = 0
        for (const msg of this.messages) {
            if (msg.role === 'user' && !msg.isUI) {
                turn++
                if (msg.id) turnByMessageId.set(msg.id, turn)
            }
        }

        return snapshotManager
            .getSnapshots()
            .filter((r) => r.messageId && turnByMessageId.has(r.messageId))
            .map((r) => ({ ...r, turnIndex: turnByMessageId.get(r.messageId!)! }))
            .sort((a, b) => b.turnIndex - a.turnIndex)
    }

    /** Restores files and conversation to the state before the snapshot's turn. */
    public async rollbackToSnapshot(snapshotId: string) {
        const { getSnapshotManager } = await import('@december/tools')
        const snapshotManager = getSnapshotManager(this.workspaceDir)
        await snapshotManager.init()

        const record = snapshotManager.getSnapshotById(snapshotId)
        if (!record) {
            throw new Error('Checkpoint not found.')
        }
        const inConversation =
            record.messageId !== undefined && this.messages.some((m) => m.id === record.messageId)
        if (!inConversation) {
            throw new Error('This turn is no longer in the conversation. Nothing was changed.')
        }

        const result = await snapshotManager.rollbackToSnapshot(snapshotId)
        this.conversation.truncateBeforeMessage(record.messageId!)
        await this.saveContext().catch(() => {
            // Intentionally swallowed: save context error
        })
        return result
    }
}
