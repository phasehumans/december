import '../../env'

import crypto from 'crypto'

import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import express, { Router } from 'express'
import request from 'supertest'

const sendNotificationMock = mock(async () => ({}))
mock.module('../../../src/modules/notification/notification.service', () => ({
    sendNotificationToUser: sendNotificationMock,
}))

import { razorpay } from '../../../src/config/razorpay'
import { errorHandler } from '../../../src/middleware/error.middleware'
import { createRateLimiter } from '../../../src/middleware/ratelimit'
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
    let isCleaningUp = false

    beforeAll(() => {
        app = express()
        app.use(express.json())

        const billingRouter = Router()
        // Mock authentication middleware
        billingRouter.use((req, _res, next) => {
            req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            next()
        })

        billingRouter.get('/overview', billingController.getOverview)
        billingRouter.get('/credits/history', billingController.getCreditsHistory)
        billingRouter.post('/wallet/order/razorpay', billingController.createRazorpayOrder)
        billingRouter.post('/wallet/verify/razorpay', billingController.verifyRazorpayPayment)
        billingRouter.post(
            '/redeem-code',
            createRateLimiter({
                windowMs: 15 * 60 * 1000,
                max: 3,
                message: 'Too many redemption attempts. Please try again in 15 minutes.',
            }),
            billingController.redeemCode
        )
        billingRouter.post('/credits/add', billingController.addCredits)

        app.use('/api/v1/billing', billingRouter)
        app.use(errorHandler)
    })

    beforeEach(async () => {
        if (isCleaningUp) return
        sendNotificationMock.mockClear()

        process.env.RAZORPAY_KEY_ID = 'rzp_route_key'
        process.env.RAZORPAY_KEY_SECRET = 'razorpay_route_secret'
        ;(razorpay.orders as any).create = async (options: any) => ({
            id: `order_route_${crypto.randomUUID()}`,
            amount: options.amount,
            currency: options.currency,
        })

        await prisma.walletTransaction.deleteMany()
        await prisma.usageEvent.deleteMany()
        await prisma.redeemCodeClaim.deleteMany()
        await prisma.redeemCode.deleteMany()
        await prisma.authSession.deleteMany()
        await prisma.user.deleteMany()

        await createTestUser()
    })

    afterAll(async () => {
        isCleaningUp = true
        await prisma.$disconnect()
    }, 15000)

    describe('GET /overview', () => {
        it('should return billing overview (200)', async () => {
            const res = await request(app).get('/api/v1/billing/overview')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.creditBalance).toBe(100)
        })
    })

    describe('GET /credits/history', () => {
        it('should return empty history (200) initially', async () => {
            const res = await request(app).get('/api/v1/billing/credits/history')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.total).toBe(0)
            expect(res.body.data.events.length).toBe(0)
        })

        it('should validate query parameters', async () => {
            const res = await request(app).get('/api/v1/billing/credits/history?limit=1000') // Above max
            expect(res.status).toBe(400)
        })
    })

    describe('POST /wallet/order/razorpay', () => {
        it('should create order successfully (201)', async () => {
            const res = await request(app).post('/api/v1/billing/wallet/order/razorpay').send({
                amountInCents: 500,
                currency: 'USD',
            })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
            expect(res.body.data.keyId).toBe('rzp_route_key')
            expect(res.body.data.orderId).toContain('order_route_')
        })

        it('should reject invalid amount (400)', async () => {
            const res = await request(app).post('/api/v1/billing/wallet/order/razorpay').send({
                amountInCents: 100, // Below min 200
            })
            expect(res.status).toBe(400)
        })
    })

    describe('POST /wallet/verify/razorpay', () => {
        it('should verify payment successfully (200)', async () => {
            const orderRes = await request(app).post('/api/v1/billing/wallet/order/razorpay').send({
                amountInCents: 500,
                currency: 'USD',
            })

            const paymentId = 'pay_route_123'
            const signature = crypto
                .createHmac('sha256', 'razorpay_route_secret')
                .update(`${orderRes.body.data.orderId}|${paymentId}`)
                .digest('hex')

            const res = await request(app).post('/api/v1/billing/wallet/verify/razorpay').send({
                razorpay_order_id: orderRes.body.data.orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
            })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.newBalance).toBe(600)
        })

        it('should reject invalid signature (400)', async () => {
            const res = await request(app).post('/api/v1/billing/wallet/verify/razorpay').send({
                razorpay_order_id: 'order_route_xyz',
                razorpay_payment_id: 'pay_route_xyz',
                razorpay_signature: 'invalid_sig',
            })

            expect(res.status).toBe(400)
            expect(res.body.message).toBe('invalid razorpay signature')
        })
    })

    describe('POST /redeem-code', () => {
        it('should fail if code is invalid (404/400)', async () => {
            const res = await request(app).post('/api/v1/billing/redeem-code').send({
                code: 'INVALID_CODE',
            })

            expect(res.status).toBe(404)
        })

        it('should enforce rate limits on multiple attempts (429)', async () => {
            for (let i = 0; i < 3; i++) {
                await request(app)
                    .post('/api/v1/billing/redeem-code')
                    .send({
                        code: `INVALID_CODE_${i}`,
                    })
            }

            const res = await request(app).post('/api/v1/billing/redeem-code').send({
                code: 'RATE_LIMIT_TEST',
            })

            expect(res.status).toBe(429)
            expect(res.text).toContain('Too many redemption attempts')
        })
    })

    describe('POST /credits/add', () => {
        it('should add credits successfully (200)', async () => {
            const res = await request(app).post('/api/v1/billing/credits/add').send({
                amountInCents: 500,
                paymentMethod: 'card',
            })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.amountInCents).toBe(500)
            expect(res.body.data.newBalance).toBe(600)
        })

        it('should reject invalid payload (400)', async () => {
            const res = await request(app).post('/api/v1/billing/credits/add').send({
                amountInCents: 50, // below 100
                paymentMethod: 'invalid',
            })

            expect(res.status).toBe(400)
        })
    })
})
