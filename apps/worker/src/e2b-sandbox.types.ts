import type { JobAttachment } from './attachments'
import type { RunSteering } from './run-steering'
import type { RunStop } from './run-stop'
import type { LLMProvider } from '@december/providers'
import type { SessionEffort } from '@december/shared'

export interface ProvisionSandboxInput {
    sessionId: string
    userId?: string
    apiKey?: string
    template?: string
    timeoutMs?: number
    backoffDelays?: number[]
    secrets?: Array<{ key: string; value: string }>
    envs?: Record<string, string>
    gitToken?: string
}

export interface ProvisionSandboxResult {
    sandboxId: string
    isMock: boolean
}

export interface ExecuteSandboxCommandInput {
    sandboxId: string
    command: string
    cwd?: string
    timeoutMs?: number
    onData?: (chunk: string) => void
    /** the stop signal of the run (#637): when it aborts, the command is killed */
    signal?: AbortSignal
}

export interface ExecuteSandboxCommandResult {
    exitCode: number
    output: string
}

export interface RunAgentSessionInput {
    sessionId: string
    userId?: string
    userRules?: string
    sandboxId?: string
    prompt: string
    workspaceDir?: string
    token?: string
    apiHostUrl?: string
    secrets?: Array<{ key: string; value: string }>
    envs?: Record<string, string>
    model?: string
    provider?: string
    /** a ready client for the user's own key; when set, no december env key is used */
    llm?: LLMProvider
    /** reasoning depth of the model for this turn (#632); runs without one keep 'fast' */
    effort?: SessionEffort
    /** write a plan and wait for approval before changing files (#632) */
    planFirst?: boolean
    /** the saved user message of this turn: history stops before it, /rewind snapshots it */
    userMessageSequence?: number
    /** saved skills the user picked with /name for this message (#632) */
    skills?: string[]
    /** saved mcp servers turned off for this session (#632) */
    disabledMcps?: string[]
    /** the files sent with this message (#634): copied into the sandbox before the turn */
    attachments?: JobAttachment[]
    /** the stop watch of this run (#637): a stop aborts the agent and ends the run */
    stop?: RunStop
    /** the messages sent while this run works (#637): the agent reads them at its next turn */
    steering?: RunSteering
}

export interface DestroySandboxInput {
    sandboxId: string
}

export interface EmitSessionEventInput {
    sessionId: string
    event: Record<string, any>
}

export interface EmitRunFailureInput {
    sessionId: string
    /** the AgentError event of the failure */
    error: Record<string, any>
}

export interface PauseSandboxInput {
    sessionId: string
    sandboxId?: string
}

export interface ResumeSandboxInput {
    sessionId: string
    snapshotId?: string
    // used when the sandbox cannot be resumed and a new one is provisioned
    userId?: string
    secrets?: Array<{ key: string; value: string }>
}

export interface AcquireSessionSandboxInput {
    sessionId: string
    userId?: string
    secrets?: Array<{ key: string; value: string }>
}

export interface ExtendSandboxTimeoutInput {
    sessionId: string
    sandboxId?: string
}

export interface KeepSandboxAliveInput {
    sessionId: string
}

export interface HandleDisconnectInput {
    sessionId: string
    gracePeriodMs?: number
}

export interface EphemeralTaskInput {
    sessionId?: string
    taskType: 'security_audit' | 'one_click_fix'
    repoUrl?: string
    gitToken?: string
    taskRunner?: (sandbox: any) => Promise<any>
}

export interface EphemeralTaskResult {
    success: boolean
    data?: any
    error?: string
}

export interface RunRepositorySetupInput {
    sessionId: string
    userId?: string
    sandboxId: string
    /** the stop watch of the run: a stop kills the setup commands */
    stop?: RunStop
}
