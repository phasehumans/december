import type { Agent } from '../agent'
import type { AgentEvent } from '@december/shared'

export type SubagentWorkspaceMode = 'inherit' | 'worktree' | 'branch'
export type SubagentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'killed'

export interface SpawnSubagentOptions {
    role: string
    task: string
    tools?: string[]
    workspace?: SubagentWorkspaceMode
    background?: boolean
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
    totalTurns: number
    toolCallsCount: number
    durationMs: number
    summary: string
    workspaceDir?: string
    worktreeBranch?: string
    modifiedFiles?: string[]
    diff?: string
    error?: string
    formattedReport: string
}

export interface SubagentHandle {
    id: string
    role: string
    task: string
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
    status: SubagentStatus
    startedAt: Date
    completedAt?: Date
    durationMs: number
    summary?: string
}
