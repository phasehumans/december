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

export class PrismaDurableStepStorage implements DurableStepStorage {
    constructor(private prisma: any) {}

    async acquireLease(input: AcquireLeaseInput): Promise<AcquireLeaseResult> {
        const { sessionId, workerId, leaseTtlMs = 5000, force = false } = input
        const now = new Date()
        const newExpiresAt = new Date(now.getTime() + leaseTtlMs)

        return await this.prisma.$transaction(async (tx: any) => {
            const session = await tx.session.findUnique({
                where: { id: sessionId },
                select: { epoch: true, leaseOwner: true, leaseExpiresAt: true, status: true },
            })

            if (!session) {
                throw new Error(`Session '${sessionId}' not found`)
            }

            const isExpired = !session.leaseExpiresAt || session.leaseExpiresAt <= now
            const isSelf = session.leaseOwner === workerId

            if (!isExpired && !isSelf && !force) {
                throw new Error(
                    `Cannot acquire lease for session '${sessionId}': currently held by '${session.leaseOwner}' until ${session.leaseExpiresAt?.toISOString()}`
                )
            }

            const newEpoch = !isSelf || isExpired ? session.epoch + 1 : session.epoch

            const updated = await tx.session.update({
                where: { id: sessionId },
                data: {
                    epoch: newEpoch,
                    leaseOwner: workerId,
                    leaseExpiresAt: newExpiresAt,
                    status: 'RUNNING',
                },
            })

            return {
                sessionId,
                epoch: updated.epoch,
                leaseExpiresAt: updated.leaseExpiresAt,
                leaseOwner: updated.leaseOwner,
                status: updated.status,
            }
        })
    }

    async renewLease(input: RenewLeaseInput): Promise<boolean> {
        const { sessionId, workerId, expectedEpoch, leaseTtlMs = 5000 } = input
        const newExpiresAt = new Date(Date.now() + leaseTtlMs)

        const result = await this.prisma.session.updateMany({
            where: {
                id: sessionId,
                epoch: expectedEpoch,
                leaseOwner: workerId,
            },
            data: {
                leaseExpiresAt: newExpiresAt,
            },
        })

        return result.count > 0
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

        const now = new Date()
        const newExpiresAt = new Date(now.getTime() + leaseTtlMs)

        return await this.prisma.$transaction(async (tx: any) => {
            const updateData: any = {}
            if (renewLease) {
                updateData.leaseExpiresAt = newExpiresAt
            }

            const updateResult = await tx.session.updateMany({
                where: {
                    id: sessionId,
                    epoch: expectedEpoch,
                },
                data: updateData,
            })

            if (updateResult.count === 0) {
                const currentSession = await tx.session.findUnique({
                    where: { id: sessionId },
                    select: { epoch: true },
                })
                throw new StaleEpochError(sessionId, expectedEpoch, currentSession?.epoch)
            }

            const step = await tx.durableStep.upsert({
                where: {
                    sessionId_stepIndex: {
                        sessionId,
                        stepIndex,
                    },
                },
                create: {
                    sessionId,
                    stepIndex,
                    stepType,
                    opId,
                    input: stepInput ?? undefined,
                    output: output ?? undefined,
                    outputRef,
                    durationMs,
                },
                update: {
                    stepType,
                    opId,
                    input: stepInput ?? undefined,
                    output: output ?? undefined,
                    outputRef,
                    durationMs,
                },
            })

            return step
        })
    }

    async getSteps(sessionId: string, fromStepIndex = 0): Promise<DurableStepRecord[]> {
        return this.prisma.durableStep.findMany({
            where: {
                sessionId,
                stepIndex: { gte: fromStepIndex },
            },
            orderBy: { stepIndex: 'asc' },
        })
    }

    async getLastStep(sessionId: string): Promise<DurableStepRecord | null> {
        return this.prisma.durableStep.findFirst({
            where: { sessionId },
            orderBy: { stepIndex: 'desc' },
        })
    }

    async releaseLease(input: ReleaseLeaseInput): Promise<boolean> {
        const { sessionId, workerId, expectedEpoch, targetStatus = 'PARKED' } = input

        const result = await this.prisma.session.updateMany({
            where: {
                id: sessionId,
                epoch: expectedEpoch,
                leaseOwner: workerId,
            },
            data: {
                leaseOwner: null,
                leaseExpiresAt: null,
                status: targetStatus,
            },
        })

        return result.count > 0
    }
}
