export type DurableStepType =
    | 'MODEL_INFERENCE'
    | 'TOOL_EXECUTION'
    | 'APPEND_USER'
    | 'COMPACTION'
    | 'STATUS_CHANGE'

export interface DurableStepRecord {
    id: string
    sessionId: string
    stepIndex: number
    stepType: DurableStepType | string
    opId?: string | null
    input?: any
    output?: any
    outputRef?: string | null
    durationMs?: number | null
    createdAt: Date
}

export class StaleEpochError extends Error {
    public readonly sessionId: string
    public readonly expectedEpoch: number
    public readonly actualEpoch?: number

    constructor(sessionId: string, expectedEpoch: number, actualEpoch?: number) {
        super(
            `Stale epoch detected for session '${sessionId}': expected epoch ${expectedEpoch}, but session was claimed by another worker (current: ${actualEpoch ?? 'unknown'})`
        )
        this.name = 'StaleEpochError'
        this.sessionId = sessionId
        this.expectedEpoch = expectedEpoch
        this.actualEpoch = actualEpoch
    }
}

export interface AcquireLeaseInput {
    sessionId: string
    workerId: string
    leaseTtlMs?: number
    force?: boolean
}

export interface AcquireLeaseResult {
    sessionId: string
    epoch: number
    leaseExpiresAt: Date
    leaseOwner: string
    status: string
}

export interface RenewLeaseInput {
    sessionId: string
    workerId: string
    expectedEpoch: number
    leaseTtlMs?: number
}

export interface CommitStepInput {
    sessionId: string
    expectedEpoch: number
    stepIndex: number
    stepType: DurableStepType | string
    opId?: string | null
    input?: any
    output?: any
    outputRef?: string | null
    durationMs?: number | null
    leaseTtlMs?: number
    renewLease?: boolean
}

export interface ReleaseLeaseInput {
    sessionId: string
    workerId: string
    expectedEpoch: number
    targetStatus?: 'IDLE' | 'PARKED' | 'COMPLETED' | 'FAILED'
}

export interface DurableStepStorage {
    acquireLease(input: AcquireLeaseInput): Promise<AcquireLeaseResult>
    renewLease(input: RenewLeaseInput): Promise<boolean>
    commitStep(input: CommitStepInput): Promise<DurableStepRecord>
    getSteps(sessionId: string, fromStepIndex?: number): Promise<DurableStepRecord[]>
    getLastStep(sessionId: string): Promise<DurableStepRecord | null>
    releaseLease(input: ReleaseLeaseInput): Promise<boolean>
}

export interface DurableStepKernelConfig {
    storage: DurableStepStorage
    workerId?: string
    defaultLeaseTtlMs?: number
    payloadOffloadThresholdBytes?: number
}
