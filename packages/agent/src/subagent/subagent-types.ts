import type { Agent } from '../agent'
import type { AgentEvent } from '@december/shared'

export type SubagentWorkspaceMode = 'inherit' | 'worktree' | 'branch'
export type SubagentWorktreeLifecycle = 'cleanup' | 'keep' | 'merge'
export type SubagentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'killed'

export interface SubagentSpecification {
    role: string
    task: string
    model?: string
    tools?: string[]
    workspace?: SubagentWorkspaceMode
    worktreeLifecycle?: SubagentWorktreeLifecycle
    maxTurns?: number
    timeoutMs?: number
}

export interface SpawnSubagentOptions {
    role: string
    task: string
    model?: string
    tools?: string[]
    workspace?: SubagentWorkspaceMode
    worktreeLifecycle?: SubagentWorktreeLifecycle
    background?: boolean
    maxTurns?: number
    timeoutMs?: number
    depth?: number
    maxDepth?: number
    parentAgent: Agent
    signal?: AbortSignal
    onEvent?: (event: AgentEvent) => void
    onStream?: (chunk: string) => void
    subagentId?: string
}

export interface SubagentRollupSummary {
    subagentId: string
    role: string
    task: string
    status: SubagentStatus
    depth: number
    model?: string
    totalTurns: number
    toolCallsCount: number
    durationMs: number
    summary: string
    workspaceDir?: string
    worktreeBranch?: string
    worktreeLifecycle?: SubagentWorktreeLifecycle
    modifiedFiles?: string[]
    diff?: string
    error?: string
    formattedReport: string
}

export interface SubagentHandle {
    id: string
    role: string
    task: string
    depth: number
    model?: string
    status: SubagentStatus
    startedAt: Date
    completedAt?: Date
    abort: () => void
    sendMessage: (message: string) => void
    promise: Promise<SubagentRollupSummary>
    getSummary: () => SubagentRollupSummary | undefined
    getOutput: () => string
}

export interface SubagentStatusInfo {
    id: string
    role: string
    task: string
    depth: number
    model?: string
    status: SubagentStatus
    startedAt: Date
    completedAt?: Date
    durationMs: number
    summary?: string
}
