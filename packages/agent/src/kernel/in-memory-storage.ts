import {
    type AcquireLeaseInput,
    type AcquireLeaseResult,
    type CommitStepInput,
    type DurableStepRecord,
    type DurableStepStorage,
    type ReleaseLeaseInput,
    type RenewLeaseInput,
    StaleEpochError,
} from './durable-kernel.types'

interface SessionState {
    epoch: number
    leaseExpiresAt: Date | null
    leaseOwner: string | null
    status: string
    steps: DurableStepRecord[]
}

export class InMemoryDurableStepStorage implements DurableStepStorage {
    private sessions = new Map<string, SessionState>()

    private getOrCreateSession(sessionId: string): SessionState {
        let state = this.sessions.get(sessionId)
        if (!state) {
            state = {
                epoch: 1,
                leaseExpiresAt: null,
                leaseOwner: null,
                status: 'IDLE',
                steps: [],
            }
            this.sessions.set(sessionId, state)
        }
        return state
    }

    async acquireLease(input: AcquireLeaseInput): Promise<AcquireLeaseResult> {
        const { sessionId, workerId, leaseTtlMs = 5000, force = false } = input
        const state = this.getOrCreateSession(sessionId)
        const now = new Date()

        const isExpired = !state.leaseExpiresAt || state.leaseExpiresAt <= now
        const isSelf = state.leaseOwner === workerId

        if (!isExpired && !isSelf && !force) {
            throw new Error(
                `Cannot acquire lease for session '${sessionId}': currently held by '${state.leaseOwner}' until ${state.leaseExpiresAt?.toISOString()}`
            )
        }

        if (!isSelf || isExpired) {
            state.epoch += 1
        }

        state.leaseOwner = workerId
        state.leaseExpiresAt = new Date(now.getTime() + leaseTtlMs)
        state.status = 'RUNNING'

        return {
            sessionId,
            epoch: state.epoch,
            leaseExpiresAt: state.leaseExpiresAt,
            leaseOwner: state.leaseOwner,
            status: state.status,
        }
    }

    async renewLease(input: RenewLeaseInput): Promise<boolean> {
        const { sessionId, workerId, expectedEpoch, leaseTtlMs = 5000 } = input
        const state = this.sessions.get(sessionId)
        if (!state) return false

        if (state.epoch !== expectedEpoch || state.leaseOwner !== workerId) {
            return false
        }

        state.leaseExpiresAt = new Date(Date.now() + leaseTtlMs)
        return true
    }

    async commitStep(input: CommitStepInput): Promise<DurableStepRecord> {
        const {
            sessionId,
            expectedEpoch,
            stepIndex,
            stepType,
            opId = null,
            input: stepInput = null,
            output = null,
            outputRef = null,
            durationMs = null,
            leaseTtlMs = 5000,
            renewLease = true,
        } = input

        const state = this.sessions.get(sessionId)
        if (!state || state.epoch !== expectedEpoch) {
            throw new StaleEpochError(sessionId, expectedEpoch, state?.epoch)
        }

        if (renewLease) {
            state.leaseExpiresAt = new Date(Date.now() + leaseTtlMs)
        }

        const record: DurableStepRecord = {
            id: `step-${sessionId}-${stepIndex}`,
            sessionId,
            stepIndex,
            stepType,
            opId,
            input: stepInput,
            output,
            outputRef,
            durationMs,
            createdAt: new Date(),
        }

        const existingIdx = state.steps.findIndex((s) => s.stepIndex === stepIndex)
        if (existingIdx !== -1) {
            state.steps[existingIdx] = record
        } else {
            state.steps.push(record)
        }

        return record
    }

    async getSteps(sessionId: string, fromStepIndex = 0): Promise<DurableStepRecord[]> {
        const state = this.sessions.get(sessionId)
        if (!state) return []
        return state.steps.filter((s) => s.stepIndex >= fromStepIndex)
    }

    async getLastStep(sessionId: string): Promise<DurableStepRecord | null> {
        const state = this.sessions.get(sessionId)
        if (!state || state.steps.length === 0) return null
        return state.steps[state.steps.length - 1] ?? null
    }

    async releaseLease(input: ReleaseLeaseInput): Promise<boolean> {
        const { sessionId, workerId, expectedEpoch, targetStatus = 'PARKED' } = input
        const state = this.sessions.get(sessionId)
        if (!state) return false

        if (state.epoch !== expectedEpoch || state.leaseOwner !== workerId) {
            return false
        }

        state.leaseOwner = null
        state.leaseExpiresAt = null
        state.status = targetStatus
        return true
    }
}
