import '../../env'

import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import express, { Router } from 'express'
import request from 'supertest'
import crypto from 'crypto'

import { razorpay } from '../../../src/config/razorpay'
import { errorHandler } from '../../../src/middleware/error.middleware'
import { billingController } from '../../../src/modules/billing/billing.controller'

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
            creditBalance: 100,
            ...overrides,
        },
    })
}

describe('billing.routes.integration', () => {
    let app: express.Application

    beforeAll(() => {
        app = express()
        app.use(
            express.json({
                verify: (req: any, _res, buf) => {
                    if (req.originalUrl === '/api/v1/billing/webhooks/coinbase') {
                        req.rawBody = Buffer.from(buf)
                    }
                },
            })
        )

        const billingRouter = Router()
        billingRouter.post('/webhooks/coinbase', billingController.handleCoinbaseWebhook)
        billingRouter.use((req, _res, next) => {
            req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            next()
        })
        billingRouter.get('/overview', billingController.getOverview)
        billingRouter.get('/credits/history', billingController.getCreditsHistory)
        billingRouter.post('/wallet/order/razorpay', billingController.createRazorpayOrder)
        billingRouter.post('/wallet/verify/razorpay', billingController.verifyRazorpayPayment)
        billingRouter.post('/wallet/order/crypto', billingController.createCryptoOrder)

        app.use('/api/v1/billing', billingRouter)
        app.use(errorHandler)
    })

    beforeEach(async () => {
        process.env.RAZORPAY_KEY_ID = 'rzp_route_key'
        process.env.RAZORPAY_KEY_SECRET = 'razorpay_route_secret'
        process.env.COINBASE_API_KEY = 'coinbase_route_key'
        process.env.COINBASE_WEBHOOK_SECRET = 'coinbase_webhook_secret'
        ;(razorpay.orders as any).create = async (options: any) => ({
            id: 'order_route_123',
            amount: options.amount,
            currency: options.currency,
        })

        await prisma.walletTransaction.deleteMany()
        await prisma.usageEvent.deleteMany()
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
        expect(res.body.data.creditBalance).toBe(100)
        expect(res.body.data.giftedCredits).toBe(0)
    })

    it('should create a Razorpay order', async () => {
        const res = await request(app).post('/api/v1/billing/wallet/order/razorpay').send({
            amountInCents: 500,
            currency: 'USD',
        })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.keyId).toBe('rzp_route_key')
        expect(res.body.data.orderId).toBe('order_route_123')
    })

    it('should verify a Razorpay order payment', async () => {
        // First create order so transaction exists in DB
        await request(app).post('/api/v1/billing/wallet/order/razorpay').send({
            amountInCents: 500,
            currency: 'USD',
        })

        const paymentId = 'pay_route_123'
        const signature = crypto
            .createHmac('sha256', 'razorpay_route_secret')
            .update(`order_route_123|${paymentId}`)
            .digest('hex')

        const res = await request(app).post('/api/v1/billing/wallet/verify/razorpay').send({
            razorpay_order_id: 'order_route_123',
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.newBalance).toBe(600) // 100 base + 500 added
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
})
