import { afterAll, beforeEach, describe, expect, it } from 'bun:test'

import { prisma } from '../../../src/config/db'
import { usageService } from '../../../src/modules/usage/usage.service'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Usage User',
            email: `usage-${crypto.randomUUID()}@example.com`,
            username: `usage-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createProject = async (userId: string, overrides: Record<string, unknown> = {}) => {
    return prisma.project.create({
        data: {
            name: 'Usage Project',
            prompt: 'Build an app',
            userId,
            ...overrides,
        },
    })
}

describe('usage.service.integration', () => {
    let userId: string

    beforeEach(async () => {
        await prisma.usageEvent.deleteMany()
        await prisma.project.deleteMany()
        await prisma.subscription.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        const user = await createUser()
        userId = user.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it('should return empty current-period usage for a new free user', async () => {
        const result = await usageService.getCurrentUsage(userId)

        expect(result.plan).toBe('FREE')
        expect(result.usage.costInCents).toBe(0)
        expect(result.usage.eventCount).toBe(0)
        expect(result.credits.limitInCents).toBe(100)
        expect(result.credits.remainingInCents).toBe(100)
    })

    it('should record usage against the current period and project relation', async () => {
        const project = await createProject(userId)

        const result = await usageService.recordUsageEvent({
            userId,
            model: 'gpt-5',
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            projectId: project.id,
            externalRequestId: `req-${crypto.randomUUID()}`,
        })

        expect(result.idempotent).toBe(false)
        expect(result.event.projectId).toBe(project.id)
        expect(result.event.periodStart).toBeInstanceOf(Date)
        expect(result.event.periodEnd).toBeInstanceOf(Date)

        const usage = await usageService.getCurrentUsage(userId)
        expect(usage.usage.inputTokens).toBe(100)
        expect(usage.usage.outputTokens).toBe(50)
        expect(usage.usage.totalTokens).toBe(150)
        // Fallback pricing: input = 2.00/1M ($0.0002/token), output = 8.00/1M ($0.0008/token)
        // Cost = (100 * 0.0002) + (50 * 0.0008) = 0.02 + 0.04 = 0.06 cents => ceiling is 1 cent
        expect(usage.usage.costInCents).toBe(1)
        expect(usage.usage.eventCount).toBe(1)
    })

    it('should return the existing event when externalRequestId is replayed', async () => {
        const externalRequestId = `req-${crypto.randomUUID()}`

        const first = await usageService.recordUsageEvent({
            userId,
            model: 'gpt-5',
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            externalRequestId,
        })

        const second = await usageService.recordUsageEvent({
            userId,
            model: 'gpt-5',
            inputTokens: 100,
            outputTokens: 100,
            totalTokens: 200,
            externalRequestId,
        })

        expect(second.idempotent).toBe(true)
        expect(second.event.id).toBe(first.event.id)

        const count = await prisma.usageEvent.count({ where: { externalRequestId } })
        expect(count).toBe(1)
    })

    it('should reject usage for a project owned by another user', async () => {
        const otherUser = await createUser()
        const otherProject = await createProject(otherUser.id)

        await expect(
            usageService.recordUsageEvent({
                userId,
                model: 'gpt-5',
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2,
                projectId: otherProject.id,
            })
        ).rejects.toThrow('project not found')
    })

    it('should report insufficient credits when the current period is exhausted', async () => {
        // Manually exhaust user's credit balance to 0
        await prisma.user.update({
            where: { id: userId },
            data: {
                creditBalance: 0,
                giftedCredits: 0,
            },
        })

        const result = await usageService.checkEnoughCredits({
            userId,
            estimatedCostInCents: 1,
        })

        expect(result.enoughCredits).toBe(false)
        expect(result.credits.remainingInCents).toBe(0)
    })
})
