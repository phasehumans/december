import '../../../tests/env'

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
        testRouter.post('/', usageController.recordUsageEvent)

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
        expect(res.body.data.credits.limitInCents).toBe(500)
    })

    it('should record a usage event', async () => {
        const res = await request(app)
            .post('/api/v1/usage')
            .send({
                model: 'gpt-5',
                inputTokens: 25,
                outputTokens: 10,
                costInCents: 4,
                externalRequestId: `req-${crypto.randomUUID()}`,
            })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.idempotent).toBe(false)
        expect(res.body.data.event.totalTokens).toBe(35)
    })

    it('should return 200 for idempotent usage replays', async () => {
        const externalRequestId = `req-${crypto.randomUUID()}`

        await request(app).post('/api/v1/usage').send({
            model: 'gpt-5',
            inputTokens: 25,
            outputTokens: 10,
            costInCents: 4,
            externalRequestId,
        })

        const res = await request(app).post('/api/v1/usage').send({
            model: 'gpt-5',
            inputTokens: 100,
            outputTokens: 100,
            costInCents: 100,
            externalRequestId,
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.idempotent).toBe(true)

        const count = await prisma.usageEvent.count({ where: { externalRequestId } })
        expect(count).toBe(1)
    })

    it('should validate usage event body', async () => {
        const res = await request(app).post('/api/v1/usage').send({
            model: '',
            costInCents: -1,
        })

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
    })

    it('should check estimated credit availability', async () => {
        const res = await request(app).get('/api/v1/usage/check?estimatedCostInCents=25')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.enoughCredits).toBe(true)
        expect(res.body.data.estimatedCostInCents).toBe(25)
    })
})
