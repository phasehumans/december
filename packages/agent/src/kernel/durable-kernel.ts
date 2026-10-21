import {
    type AcquireLeaseResult,
    type CommitStepInput,
    type DurableStepKernelConfig,
    type DurableStepRecord,
    type DurableStepStorage,
    type DurableStepType,
    StaleEpochError,
} from './durable-kernel.types'

const DEFAULT_PAYLOAD_OFFLOAD_THRESHOLD = 32 * 1024 // 32KB
const DEFAULT_LEASE_TTL_MS = 5000 // 5 seconds

export class DurableStepKernel {
    private storage: DurableStepStorage
    private workerId: string
    private defaultLeaseTtlMs: number
    private payloadOffloadThreshold: number

    private activeEpochs = new Map<string, number>()
    private nextStepIndices = new Map<string, number>()

    constructor(config: DurableStepKernelConfig) {
        this.storage = config.storage
        this.workerId = config.workerId || `worker-${Math.random().toString(36).substring(2, 9)}`
        this.defaultLeaseTtlMs = config.defaultLeaseTtlMs || DEFAULT_LEASE_TTL_MS
        this.payloadOffloadThreshold =
            config.payloadOffloadThresholdBytes || DEFAULT_PAYLOAD_OFFLOAD_THRESHOLD
    }

    getWorkerId(): string {
        return this.workerId
    }

    getCurrentEpoch(sessionId: string): number | undefined {
        return this.activeEpochs.get(sessionId)
    }

    async acquireLease(
        sessionId: string,
        ttlMs?: number,
        force = false
    ): Promise<AcquireLeaseResult> {
        const result = await this.storage.acquireLease({
            sessionId,
            workerId: this.workerId,
            leaseTtlMs: ttlMs || this.defaultLeaseTtlMs,
            force,
        })

        this.activeEpochs.set(sessionId, result.epoch)

        const lastStep = await this.storage.getLastStep(sessionId)
        this.nextStepIndices.set(sessionId, lastStep ? lastStep.stepIndex + 1 : 1)

        return result
    }

    async renewLease(sessionId: string, ttlMs?: number): Promise<boolean> {
        const expectedEpoch = this.activeEpochs.get(sessionId)
        if (expectedEpoch === undefined) return false

        return this.storage.renewLease({
            sessionId,
            workerId: this.workerId,
            expectedEpoch,
            leaseTtlMs: ttlMs || this.defaultLeaseTtlMs,
        })
    }

    async releaseLease(
        sessionId: string,
        targetStatus: 'IDLE' | 'PARKED' | 'COMPLETED' | 'FAILED' = 'PARKED'
    ): Promise<boolean> {
        const expectedEpoch = this.activeEpochs.get(sessionId)
        if (expectedEpoch === undefined) return false

        const released = await this.storage.releaseLease({
            sessionId,
            workerId: this.workerId,
            expectedEpoch,
            targetStatus,
        })

        if (released) {
            this.activeEpochs.delete(sessionId)
            this.nextStepIndices.delete(sessionId)
        }

        return released
    }

    async commitStep(params: {
        sessionId: string
        stepType: DurableStepType | string
        opId?: string | null
        input?: any
        output?: any
        outputRef?: string | null
        durationMs?: number | null
        leaseTtlMs?: number
    }): Promise<DurableStepRecord> {
        const {
            sessionId,
            stepType,
            opId = null,
            input: stepInput = null,
            output = null,
            outputRef: initialOutputRef = null,
            durationMs = null,
            leaseTtlMs,
        } = params

        const expectedEpoch = this.activeEpochs.get(sessionId)
        if (expectedEpoch === undefined) {
            throw new Error(
                `Cannot commit step for session '${sessionId}': lease is not held by worker '${this.workerId}'`
            )
        }

        let stepIndex = this.nextStepIndices.get(sessionId)
        if (stepIndex === undefined) {
            const lastStep = await this.storage.getLastStep(sessionId)
            stepIndex = lastStep ? lastStep.stepIndex + 1 : 1
            this.nextStepIndices.set(sessionId, stepIndex)
        }

        let processedOutput = output
        let processedOutputRef = initialOutputRef

        if (output !== null && output !== undefined) {
            const outputString = typeof output === 'string' ? output : JSON.stringify(output)
            const byteLength = Buffer.byteLength(outputString, 'utf8')

            if (byteLength > this.payloadOffloadThreshold && !processedOutputRef) {
                processedOutputRef = `payloads/${sessionId}/step-${stepIndex}-${opId || 'raw'}.log`
                processedOutput = {
                    __offloaded: true,
                    sizeBytes: byteLength,
                    ref: processedOutputRef,
                    preview: outputString.slice(0, 1024),
                }
            }
        }

        const commitInput: CommitStepInput = {
            sessionId,
            expectedEpoch,
            stepIndex,
            stepType,
            opId,
            input: stepInput,
            output: processedOutput,
            outputRef: processedOutputRef,
            durationMs,
            leaseTtlMs: leaseTtlMs || this.defaultLeaseTtlMs,
            renewLease: true,
        }

        try {
            const record = await this.storage.commitStep(commitInput)
            this.nextStepIndices.set(sessionId, stepIndex + 1)
            return record
        } catch (err: any) {
            if (err instanceof StaleEpochError) {
                this.activeEpochs.delete(sessionId)
                this.nextStepIndices.delete(sessionId)
            }
            throw err
        }
    }

    async executeStep<T>(
        sessionId: string,
        stepType: DurableStepType | string,
        stepFn: () => Promise<T>,
        metadata?: { opId?: string | null; input?: any }
    ): Promise<{ result: T; step: DurableStepRecord }> {
        const startTime = Date.now()
        let result: T

        try {
            result = await stepFn()
        } catch (err) {
            const durationMs = Date.now() - startTime
            await this.commitStep({
                sessionId,
                stepType,
                opId: metadata?.opId,
                input: metadata?.input,
                output: { error: String(err) },
                durationMs,
            })
            throw err
        }

        const durationMs = Date.now() - startTime
        const step = await this.commitStep({
            sessionId,
            stepType,
            opId: metadata?.opId,
            input: metadata?.input,
            output: result,
            durationMs,
        })

        return { result, step }
    }

    async getHistory(sessionId: string, fromStepIndex = 0): Promise<DurableStepRecord[]> {
        return this.storage.getSteps(sessionId, fromStepIndex)
    }

    async getLastStep(sessionId: string): Promise<DurableStepRecord | null> {
        return this.storage.getLastStep(sessionId)
    }
}
