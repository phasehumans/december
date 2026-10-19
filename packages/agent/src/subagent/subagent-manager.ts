import { EventEmitter } from 'node:events'

import { executeDynamicSubagent } from './dynamic-subagent'

import type {
    SpawnSubagentOptions,
    SubagentHandle,
    SubagentRollupSummary,
    SubagentStatusInfo,
} from './subagent-types'
import type { SubagentTaskTracker } from '@december/shared'

export class SubagentManager extends EventEmitter {
    private subagents = new Map<string, SubagentHandle>()
    private summaries = new Map<string, SubagentRollupSummary>()
    private outputs = new Map<string, string>()
    private tracker?: SubagentTaskTracker
    private nextId = 1

    constructor(tracker?: SubagentTaskTracker) {
        super()
        this.tracker = tracker
    }

    public setTracker(tracker: SubagentTaskTracker): void {
        this.tracker = tracker
    }

    public getTracker(): SubagentTaskTracker | undefined {
        return this.tracker
    }

    public spawnBackground(options: SpawnSubagentOptions): SubagentHandle {
        const id =
            options.subagentId ||
            `subagent-${options.role.replace(/[^a-zA-Z0-9_-]/g, '_')}-${this.nextId++}`
        const abortController = new AbortController()

        // Combine with caller signal if supplied
        if (options.signal) {
            options.signal.addEventListener('abort', () => abortController.abort(), { once: true })
        }

        const childDepth = options.depth ?? (options.parentAgent.depth ?? 0) + 1
        const effectiveModel = options.model || (options.parentAgent.modelOptions as any)?.model

        let childAgentRef: any = null
        let accumulatedOutput = ''

        const onStream = (chunk: string) => {
            accumulatedOutput += chunk
            this.outputs.set(id, accumulatedOutput)
            if (this.tracker) {
                this.tracker.appendOutput(id, chunk)
            }
            this.emit('subagent:output', id, chunk)
            this.emit('change')
            options.onStream?.(chunk)
        }

        const handle: SubagentHandle = {
            id,
            role: options.role,
            task: options.task,
            depth: childDepth,
            model: effectiveModel,
            status: 'running',
            startedAt: new Date(),
            abort: () => {
                abortController.abort()
                if (childAgentRef?.abort) {
                    childAgentRef.abort()
                }
                if (handle.status === 'running') {
                    handle.status = 'killed'
                    handle.completedAt = new Date()
                    this.emit('subagent:killed', handle)
                    this.emit('change')
                }
            },
            sendMessage: (message: string) => {
                const notice = `\n[Steering Message]: ${message}\n`
                accumulatedOutput += notice
                this.outputs.set(id, accumulatedOutput)
                if (this.tracker) {
                    this.tracker.appendOutput(id, notice)
                }

                if (childAgentRef?.steer) {
                    childAgentRef.steer({ role: 'user', content: message })
                    return true
                }
                return false
            },
            promise: (async () => {
                try {
                    const result = await executeDynamicSubagent({
                        ...options,
                        subagentId: id,
                        depth: childDepth,
                        signal: abortController.signal,
                        onStream,
                    })

                    childAgentRef = (options as any)._childAgent
                    handle.status = result.status
                    handle.completedAt = new Date()
                    this.summaries.set(id, result)

                    const exitCode = result.status === 'completed' ? 0 : 1
                    if (this.tracker) {
                        this.tracker.markCompleted(id, exitCode)
                    }

                    this.emit('subagent:completed', handle, result)
                    this.emit('change')
                    return result
                } catch (err: any) {
                    const failResult: SubagentRollupSummary = {
                        subagentId: id,
                        role: options.role,
                        task: options.task,
                        depth: childDepth,
                        model: effectiveModel,
                        status: 'failed',
                        totalTurns: 0,
                        toolCallsCount: 0,
                        durationMs: Date.now() - handle.startedAt.getTime(),
                        summary: `Subagent failed with error: ${err.message}`,
                        error: err.message,
                        formattedReport: `### [SubAgent: ${options.role} (${id})] - FAILED\n- **Depth**: ${childDepth}\n- **Subagent**: ${options.role}\n**Error**: ${err.message}`,
                    }

                    handle.status = 'failed'
                    handle.completedAt = new Date()
                    this.summaries.set(id, failResult)

                    if (this.tracker) {
                        this.tracker.markCompleted(id, 1)
                    }

                    this.emit('subagent:completed', handle, failResult)
                    this.emit('change')
                    return failResult
                }
            })(),
            getSummary: () => this.summaries.get(id),
            getOutput: () => this.outputs.get(id) || accumulatedOutput,
        }

        this.subagents.set(id, handle)

        if (this.tracker) {
            this.tracker.registerSubagentTask({
                id,
                role: `depth ${childDepth} - ${options.role}`,
                task: options.task,
                abortController,
                onKill: () => handle.abort(),
            })
        }

        this.emit('subagent:added', handle)
        this.emit('change')
        return handle
    }

    public async spawn(options: SpawnSubagentOptions): Promise<SubagentRollupSummary> {
        const handle = this.spawnBackground(options)
        return handle.promise
    }

    public get(id: string): SubagentHandle | undefined {
        return this.subagents.get(id)
    }

    public getSummary(id: string): SubagentRollupSummary | undefined {
        return this.summaries.get(id)
    }

    public getOutput(id: string): string {
        return this.outputs.get(id) || ''
    }

    public list(): SubagentStatusInfo[] {
        return Array.from(this.subagents.values()).map((h) => ({
            id: h.id,
            role: h.role,
            task: h.task,
            depth: h.depth,
            model: h.model,
            status: h.status,
            startedAt: h.startedAt,
            completedAt: h.completedAt,
            durationMs: (h.completedAt?.getTime() || Date.now()) - h.startedAt.getTime(),
            summary: this.summaries.get(h.id)?.summary,
        }))
    }

    public sendMessage(id: string, message: string): boolean {
        const handle = this.subagents.get(id)
        if (handle && handle.status === 'running') {
            handle.sendMessage(message)
            return true
        }
        return false
    }

    public kill(id: string): boolean {
        const handle = this.subagents.get(id)
        if (handle && handle.status === 'running') {
            handle.abort()
            return true
        }
        return false
    }

    public killAll(): number {
        let count = 0
        for (const handle of this.subagents.values()) {
            if (handle.status === 'running') {
                handle.abort()
                count++
            }
        }
        return count
    }

    public clearCompleted(): void {
        for (const [id, handle] of Array.from(this.subagents.entries())) {
            if (handle.status !== 'running') {
                this.subagents.delete(id)
                this.summaries.delete(id)
                this.outputs.delete(id)
            }
        }
        this.emit('change')
    }
}

export const defaultSubagentManager = new SubagentManager()
