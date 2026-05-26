import '../../../tests/env'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import express, { Router } from 'express'
import request from 'supertest'

import { prisma } from '../../../src/config/db'
import { razorpay } from '../../../src/config/razorpay'
import { billingController } from '../../../src/modules/billing/billing.controller'
import { createHmacSignature } from '../../../src/modules/billing/billing.utils'

const TEST_USER_ID = 'test-billing-user-id'
const TEST_SESSION_ID = 'test-billing-session-id'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            name: 'Billing Route User',
            email: `billing-route-${crypto.randomUUID()}@example.com`,
            username: `billing-route-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const activeRazorpaySubscription = (overrides: Record<string, unknown> = {}) => ({
    id: 'sub_route_123',
    entity: 'subscription',
    plan_id: 'plan_route_pro',
    status: 'active',
    current_start: 1_780_000_000,
    current_end: 1_782_592_000,
    customer_id: 'cust_route_123',
    short_url: 'https://rzp.io/i/route',
    notes: {
        userId: TEST_USER_ID,
        plan: 'PRO',
    },
    ...overrides,
})

describe('billing.routes.integration', () => {
    let app: express.Application

    beforeAll(() => {
        app = express()
        app.use(
            express.json({
                verify: (req: any, _res, buf) => {
                    if (req.originalUrl === '/api/v1/billing/webhooks/razorpay') {
                        req.rawBody = Buffer.from(buf)
                    }
                },
            })
        )

        const billingRouter = Router()
        billingRouter.post('/webhooks/razorpay', billingController.handleRazorpayWebhook)
        billingRouter.use((req, _res, next) => {
            req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            next()
        })
        billingRouter.get('/overview', billingController.getOverview)
        billingRouter.get('/plans', billingController.getPlans)
        billingRouter.post('/subscription', billingController.createSubscription)
        billingRouter.post('/subscription/verify', billingController.verifySubscription)
        billingRouter.post('/subscription/cancel', billingController.cancelSubscription)
        billingRouter.get('/credits/history', billingController.getCreditsHistory)
        billingRouter.post('/portal', billingController.createPortalSession)

        app.use('/api/v1/billing', billingRouter)
    })

    beforeEach(async () => {
        process.env.RAZORPAY_KEY_ID = 'rzp_route_key'
        process.env.RAZORPAY_KEY_SECRET = 'razorpay_route_secret'
        process.env.RAZORPAY_PRO_PLAN_ID = 'plan_route_pro'
        process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_route_secret'
        ;(razorpay.plans as any).fetch = async () => ({
            id: 'plan_route_pro',
            period: 'monthly',
            item: {
                amount: 99900,
                currency: 'INR',
            },
        })
        ;(razorpay.subscriptions as any).create = async () => activeRazorpaySubscription()
        ;(razorpay.subscriptions as any).fetch = async () => activeRazorpaySubscription()
        ;(razorpay.subscriptions as any).cancel = async () =>
            activeRazorpaySubscription({
                status: 'cancelled',
                ended_at: 1_782_000_000,
            })

        await prisma.usageEvent.deleteMany()
        await prisma.subscription.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        await createTestUser()
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it('should return billing overview', async () => {
        const res = await request(app).get('/api/v1/billing/overview')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.plan).toBe('FREE')
        expect(res.body.data.credits.limitInCents).toBe(100)
    })

    it('should return billing plans', async () => {
        const res = await request(app).get('/api/v1/billing/plans')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.some((plan: { id: string }) => plan.id === 'PRO')).toBe(true)
    })

    it('should create a Razorpay subscription', async () => {
        const res = await request(app).post('/api/v1/billing/subscription').send({
            plan: 'PRO',
            quantity: 1,
            totalCount: 12,
        })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.keyId).toBe('rzp_route_key')
        expect(res.body.data.subscriptionId).toBe('sub_route_123')
    })

    it('should verify a Razorpay subscription payment', async () => {
        const paymentId = 'pay_route_123'
        const signature = createHmacSignature(
            `${paymentId}|sub_route_123`,
            process.env.RAZORPAY_KEY_SECRET as string
        )

        const res = await request(app).post('/api/v1/billing/subscription/verify').send({
            razorpay_subscription_id: 'sub_route_123',
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.user.subscriptionPlan).toBe('PRO')
    })

    it('should cancel a Razorpay subscription', async () => {
        await prisma.user.update({
            where: {
                id: TEST_USER_ID,
            },
            data: {
                subscriptionPlan: 'PRO',
                subscriptionStatus: 'ACTIVE',
            },
        })
        await prisma.subscription.create({
            data: {
                userId: TEST_USER_ID,
                provider: 'razorpay',
                providerSubscriptionId: 'sub_route_123',
                providerCustomerId: 'cust_route_123',
                providerPlanId: 'plan_route_pro',
                status: 'ACTIVE',
                plan: 'PRO',
                currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
                currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
            },
        })

        const res = await request(app).post('/api/v1/billing/subscription/cancel').send({
            cancelAtPeriodEnd: false,
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.user.subscriptionPlan).toBe('FREE')
    })

    it('should return credits history', async () => {
        const periodStart = new Date('2026-05-01T00:00:00.000Z')
        const periodEnd = new Date('2026-06-01T00:00:00.000Z')

        await prisma.usageEvent.create({
            data: {
                userId: TEST_USER_ID,
                model: 'gpt-5',
                inputTokens: 10,
                outputTokens: 5,
                totalTokens: 15,
                costInCents: 3,
                periodStart,
                periodEnd,
            },
        })

        const res = await request(app).get('/api/v1/billing/credits/history')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.total).toBe(1)
        expect(res.body.data.events[0].costInCents).toBe(3)
    })

    it('should return a Razorpay portal target', async () => {
        const res = await request(app).post('/api/v1/billing/portal')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.provider).toBe('razorpay')
        expect(res.body.data.url).toContain('razorpay.com')
    })

    it('should process a signed Razorpay webhook without auth', async () => {
        const payload = {
            event: 'subscription.activated',
            payload: {
                subscription: {
                    entity: activeRazorpaySubscription(),
                },
            },
        }
        const rawBody = JSON.stringify(payload)
        const signature = createHmacSignature(rawBody, 'webhook_route_secret')

        const res = await request(app)
            .post('/api/v1/billing/webhooks/razorpay')
            .set('x-razorpay-signature', signature)
            .send(payload)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.processed).toBe(true)
    })
})
