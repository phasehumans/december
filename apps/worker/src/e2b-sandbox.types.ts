import type { LLMProvider } from '@december/providers'

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
}

export interface DestroySandboxInput {
    sandboxId: string
}

export interface EmitSessionEventInput {
    sessionId: string
    event: Record<string, any>
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
