import '../../env'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import express, { Router } from 'express'
import request from 'supertest'

import { prisma } from '../../../src/config/db'
import { usageController } from '../../../src/modules/usage/usage.controller'

const TEST_USER_ID = 'test-usage-user-id'
const TEST_SESSION_ID = 'test-usage-session-id'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            name: 'Usage User',
            email: `usage-route-${crypto.randomUUID()}@example.com`,
            username: `usage-route-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

describe('usage.routes.integration', () => {
    let app: express.Application

    beforeAll(() => {
        app = express()
        app.use(express.json())
        app.use((req, _res, next) => {
            req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            next()
        })

        const testRouter = Router()
        testRouter.get('/', usageController.getCurrentUsage)
        testRouter.get('/check', usageController.checkEnoughCredits)

        app.use('/api/v1/usage', testRouter)
    })

    beforeEach(async () => {
        await prisma.usageEvent.deleteMany()
        await prisma.project.deleteMany()
        await prisma.subscription.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        await createTestUser()
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it('should return current usage', async () => {
        const res = await request(app).get('/api/v1/usage')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.usage.costInCents).toBe(0)
        expect(res.body.data.credits.limitInCents).toBe(100)
        expect(res.body.data.credits.remainingInCents).toBe(100)
    })

    it('should check estimated credit availability', async () => {
        const res = await request(app).get('/api/v1/usage/check?estimatedCostInCents=25')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.enoughCredits).toBe(true)
        expect(res.body.data.estimatedCostInCents).toBe(25)
    })
})
