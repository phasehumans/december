import { describe, it, expect } from 'bun:test'

import { usageRepository } from '../../src/modules/usage/usage.repository'
import { usageService } from '../../src/modules/usage/usage.service'
import { AppError } from '../../src/shared/appError'

describe('Usage Service - Unit Tests', () => {
    describe('calculateGenerationCost', () => {
        it('should return 0 cost if both inputTokens and outputTokens are 0', () => {
            const cost = usageService.calculateGenerationCost({
                modelName: 'openai/gpt-4o',
                inputTokens: 0,
                outputTokens: 0,
            })
            expect(cost).toBe(0)
        })

        it('should calculate accurate fractional cost for small token counts', () => {
            const cost = usageService.calculateGenerationCost({
                modelName: 'gemini-2.5-flash',
                inputTokens: 10,
                outputTokens: 10,
            })
            expect(cost).toBeGreaterThan(0)
            expect(cost).toBeLessThan(1)
        })

        it('should resolve cost correctly for heavy token counts', () => {
            const cost = usageService.calculateGenerationCost({
                modelName: 'openai/gpt-4o',
                inputTokens: 100000,
                outputTokens: 50000,
            })
            expect(cost).toBeGreaterThan(1)
        })
    })

    describe('getCurrentUsage', () => {
        it('should throw AppError 404 if user not found', async () => {
            const originalGet = usageRepository.getUsageUser
            usageRepository.getUsageUser = (async () => null) as any

            try {
                await expect(usageService.getCurrentUsage({ userId: 'u1' })).rejects.toThrow(
                    new AppError('user not found', 404)
                )
            } finally {
                usageRepository.getUsageUser = originalGet
            }
        })

        it('should return usage aggregate and remaining credit details', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalAgg = usageRepository.getPeriodAggregate

            usageRepository.getUsageUser = (async () => ({
                id: 'u1',
                creditBalance: 500,
                createdAt: new Date(),
                isDeleted: false,
            })) as any

            usageRepository.getPeriodAggregate = (async () => ({
                costInCents: 150,
                inputTokens: 1000,
                outputTokens: 500,
                totalTokens: 1500,
            })) as any

            try {
                const res = await usageService.getCurrentUsage({ userId: 'u1' })
                expect(res.credits.usedInCents).toBe(150)
                expect(res.credits.remainingInCents).toBe(500)
                expect(res.credits.unlimited).toBe(false)
                expect(res.usage.totalTokens).toBe(1500)
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.getPeriodAggregate = originalAgg
            }
        })
    })

    describe('checkEnoughCredits', () => {
        it('should return enoughCredits true when credit balance is greater than or equal to estimated cost', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalAgg = usageRepository.getPeriodAggregate

            usageRepository.getUsageUser = (async () => ({
                id: 'u1',
                creditBalance: 200,
                createdAt: new Date(),
                isDeleted: false,
            })) as any
            usageRepository.getPeriodAggregate = (async () => ({
                costInCents: 0,
                totalTokens: 0,
            })) as any

            try {
                const res = await usageService.checkEnoughCredits({
                    userId: 'u1',
                    estimatedCostInCents: 100,
                })
                expect(res.enoughCredits).toBe(true)
                expect(res.estimatedCostInCents).toBe(100)
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.getPeriodAggregate = originalAgg
            }
        })

        it('should return enoughCredits false when credit balance is less than estimated cost', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalAgg = usageRepository.getPeriodAggregate

            usageRepository.getUsageUser = (async () => ({
                id: 'u1',
                creditBalance: 50,
                createdAt: new Date(),
                isDeleted: false,
            })) as any
            usageRepository.getPeriodAggregate = (async () => ({
                costInCents: 0,
                totalTokens: 0,
            })) as any

            try {
                const res = await usageService.checkEnoughCredits({
                    userId: 'u1',
                    estimatedCostInCents: 100,
                })
                expect(res.enoughCredits).toBe(false)
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.getPeriodAggregate = originalAgg
            }
        })
    })

    describe('hasMinimumBalance', () => {
        it('should return true if balance >= 1 cent by default', async () => {
            const originalGet = usageRepository.getUsageUser
            usageRepository.getUsageUser = (async () => ({
                id: 'u1',
                creditBalance: 1,
            })) as any

            try {
                const res = await usageService.hasMinimumBalance({ userId: 'u1' })
                expect(res).toBe(true)
            } finally {
                usageRepository.getUsageUser = originalGet
            }
        })

        it('should verify custom minBalanceInCents threshold (e.g. 50 cents)', async () => {
            const originalGet = usageRepository.getUsageUser
            usageRepository.getUsageUser = (async () => ({
                id: 'u1',
                creditBalance: 40,
            })) as any

            try {
                const res = await usageService.hasMinimumBalance({
                    userId: 'u1',
                    minBalanceInCents: 50,
                })
                expect(res).toBe(false)
            } finally {
                usageRepository.getUsageUser = originalGet
            }
        })

        it('should return false if balance is 0', async () => {
            const originalGet = usageRepository.getUsageUser
            usageRepository.getUsageUser = (async () => ({
                id: 'u1',
                creditBalance: 0,
            })) as any

            try {
                const res = await usageService.hasMinimumBalance({ userId: 'u1' })
                expect(res).toBe(false)
            } finally {
                usageRepository.getUsageUser = originalGet
            }
        })
    })

    describe('recordUsageEvent', () => {
        it('should return existing event with idempotent: true if externalRequestId matches same user', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalFindExt = usageRepository.findExternalUsageEvent

            usageRepository.getUsageUser = (async () => ({ id: 'u1', creditBalance: 100 })) as any
            usageRepository.findExternalUsageEvent = (async () => ({
                id: 'ev-1',
                userId: 'u1',
                externalRequestId: 'req-123',
            })) as any

            try {
                const res = await usageService.recordUsageEvent({
                    userId: 'u1',
                    model: 'gpt-4o',
                    inputTokens: 10,
                    outputTokens: 10,
                    totalTokens: 20,
                    externalRequestId: 'req-123',
                })
                expect(res.idempotent).toBe(true)
                expect(res.event.id).toBe('ev-1')
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.findExternalUsageEvent = originalFindExt
            }
        })

        it('should throw AppError 409 if externalRequestId belongs to different user', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalFindExt = usageRepository.findExternalUsageEvent

            usageRepository.getUsageUser = (async () => ({ id: 'u1', creditBalance: 100 })) as any
            usageRepository.findExternalUsageEvent = (async () => ({
                id: 'ev-1',
                userId: 'other-user',
                externalRequestId: 'req-123',
            })) as any

            try {
                await expect(
                    usageService.recordUsageEvent({
                        userId: 'u1',
                        model: 'gpt-4o',
                        inputTokens: 10,
                        outputTokens: 10,
                        totalTokens: 20,
                        externalRequestId: 'req-123',
                    })
                ).rejects.toThrow(new AppError('external request id already exists', 409))
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.findExternalUsageEvent = originalFindExt
            }
        })

        it('should deduct credits and create usage event within transaction', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalFindExt = usageRepository.findExternalUsageEvent
            const originalTx = usageRepository.runTransaction
            const originalFindCredits = usageRepository.findUserCredits
            const originalUpdateCredits = usageRepository.updateUserCredits
            const originalCreateEvent = usageRepository.createUsageEvent

            usageRepository.getUsageUser = (async () => ({ id: 'u1', creditBalance: 100 })) as any
            usageRepository.findExternalUsageEvent = (async () => null) as any
            usageRepository.runTransaction = (async (cb: any) => cb({})) as any

            let updatedCreditsPayload: any = null
            usageRepository.findUserCredits = (async () => ({
                id: 'u1',
                creditBalance: 100,
            })) as any
            usageRepository.updateUserCredits = (async (data: any) => {
                updatedCreditsPayload = data
                return data
            }) as any
            usageRepository.createUsageEvent = (async (data: any) => ({
                id: 'new-event-1',
                ...data,
            })) as any

            try {
                const res = await usageService.recordUsageEvent({
                    userId: 'u1',
                    model: 'openai/gpt-4o',
                    inputTokens: 10,
                    outputTokens: 10,
                    totalTokens: 20,
                })

                expect(res.idempotent).toBe(false)
                expect(res.event.id).toBe('new-event-1')
                expect(updatedCreditsPayload).not.toBeNull()
                expect(updatedCreditsPayload.userId).toBe('u1')
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.findExternalUsageEvent = originalFindExt
                usageRepository.runTransaction = originalTx
                usageRepository.findUserCredits = originalFindCredits
                usageRepository.updateUserCredits = originalUpdateCredits
                usageRepository.createUsageEvent = originalCreateEvent
            }
        })

        it('should allow soft overdraft transition into negative balance', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalFindExt = usageRepository.findExternalUsageEvent
            const originalTx = usageRepository.runTransaction
            const originalFindCredits = usageRepository.findUserCredits
            const originalUpdateCredits = usageRepository.updateUserCredits
            const originalCreateEvent = usageRepository.createUsageEvent

            usageRepository.getUsageUser = (async () => ({ id: 'u1', creditBalance: 1 })) as any
            usageRepository.findExternalUsageEvent = (async () => null) as any
            usageRepository.runTransaction = (async (cb: any) => cb({})) as any

            let updatedBalance = 0
            usageRepository.findUserCredits = (async () => ({
                id: 'u1',
                creditBalance: 1, // Only 1 cent remaining
            })) as any
            usageRepository.updateUserCredits = (async (data: any) => {
                updatedBalance = data.creditBalance
                return data
            }) as any
            usageRepository.createUsageEvent = (async (data: any) => ({
                id: 'new-event-overdraft',
                ...data,
            })) as any

            try {
                // gpt-4o: 1000 input, 1000 output -> 2.5/10 + 10.0/10 = 0.25 + 1.0 = 1.25 cents cost
                const res = await usageService.recordUsageEvent({
                    userId: 'u1',
                    model: 'gpt-4o',
                    inputTokens: 1000,
                    outputTokens: 1000,
                    totalTokens: 2000,
                })

                expect(res.idempotent).toBe(false)
                // 1 - 1.25 = -0.25 cents (negative overdraft)
                expect(updatedBalance).toBeCloseTo(-0.25)
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.findExternalUsageEvent = originalFindExt
                usageRepository.runTransaction = originalTx
                usageRepository.findUserCredits = originalFindCredits
                usageRepository.updateUserCredits = originalUpdateCredits
                usageRepository.createUsageEvent = originalCreateEvent
            }
        })

        it('should handle P2002 race condition by returning existing event if same user', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalFindExt = usageRepository.findExternalUsageEvent
            const originalTx = usageRepository.runTransaction

            usageRepository.getUsageUser = (async () => ({ id: 'u1', creditBalance: 100 })) as any
            // Initially null before concurrent insert completes
            let findCount = 0
            usageRepository.findExternalUsageEvent = (async () => {
                findCount++
                if (findCount === 1) return null
                return { id: 'race-event-1', userId: 'u1', externalRequestId: 'race-req-1' }
            }) as any

            const p2002Error: any = new Error('Unique constraint failed')
            p2002Error.code = 'P2002'
            usageRepository.runTransaction = (async () => {
                throw p2002Error
            }) as any

            try {
                const res = await usageService.recordUsageEvent({
                    userId: 'u1',
                    model: 'gpt-4o',
                    inputTokens: 10,
                    outputTokens: 10,
                    totalTokens: 20,
                    externalRequestId: 'race-req-1',
                })

                expect(res.idempotent).toBe(true)
                expect(res.event.id).toBe('race-event-1')
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.findExternalUsageEvent = originalFindExt
                usageRepository.runTransaction = originalTx
            }
        })

        it('should rethrow error if non-P2002 error occurs during transaction', async () => {
            const originalGet = usageRepository.getUsageUser
            const originalFindExt = usageRepository.findExternalUsageEvent
            const originalTx = usageRepository.runTransaction

            usageRepository.getUsageUser = (async () => ({ id: 'u1', creditBalance: 100 })) as any
            usageRepository.findExternalUsageEvent = (async () => null) as any
            usageRepository.runTransaction = (async () => {
                throw new Error('Database connection failed')
            }) as any

            try {
                await expect(
                    usageService.recordUsageEvent({
                        userId: 'u1',
                        model: 'gpt-4o',
                        inputTokens: 10,
                        outputTokens: 10,
                        totalTokens: 20,
                    })
                ).rejects.toThrow('Database connection failed')
            } finally {
                usageRepository.getUsageUser = originalGet
                usageRepository.findExternalUsageEvent = originalFindExt
                usageRepository.runTransaction = originalTx
            }
        })
    })

    describe('canRunSelfCorrection', () => {
        it('should return true if balance >= default threshold (5 cents)', async () => {
            const originalFind = usageRepository.findUserCredits
            usageRepository.findUserCredits = (async () => ({ id: 'u1', creditBalance: 5 })) as any

            try {
                const res = await usageService.canRunSelfCorrection({ userId: 'u1' })
                expect(res).toBe(true)
            } finally {
                usageRepository.findUserCredits = originalFind
            }
        })

        it('should return false if balance < threshold', async () => {
            const originalFind = usageRepository.findUserCredits
            usageRepository.findUserCredits = (async () => ({ id: 'u1', creditBalance: 4 })) as any

            try {
                const res = await usageService.canRunSelfCorrection({ userId: 'u1' })
                expect(res).toBe(false)
            } finally {
                usageRepository.findUserCredits = originalFind
            }
        })

        it('should respect custom SELF_CORRECTION_CREDIT_THRESHOLD env variable', async () => {
            const originalFind = usageRepository.findUserCredits
            const originalEnv = process.env.SELF_CORRECTION_CREDIT_THRESHOLD
            process.env.SELF_CORRECTION_CREDIT_THRESHOLD = '15'

            usageRepository.findUserCredits = (async () => ({ id: 'u1', creditBalance: 10 })) as any

            try {
                // 10 is below 15 threshold
                const res = await usageService.canRunSelfCorrection({ userId: 'u1' })
                expect(res).toBe(false)
            } finally {
                usageRepository.findUserCredits = originalFind
                if (originalEnv !== undefined) {
                    process.env.SELF_CORRECTION_CREDIT_THRESHOLD = originalEnv
                } else {
                    delete process.env.SELF_CORRECTION_CREDIT_THRESHOLD
                }
            }
        })

        it('should return false when user is not found or error occurs', async () => {
            const originalFind = usageRepository.findUserCredits
            usageRepository.findUserCredits = (async () => {
                throw new Error('DB timeout')
            }) as any

            try {
                const res = await usageService.canRunSelfCorrection({ userId: 'u1' })
                expect(res).toBe(false)
            } finally {
                usageRepository.findUserCredits = originalFind
            }
        })
    })
})
