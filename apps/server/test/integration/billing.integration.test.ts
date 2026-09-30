import crypto from 'crypto'

import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { razorpay } from '../../src/config/razorpay'

describe('Billing Integration Tests', () => {
    let testUserId: string
    let testEmail: string
    let testUserBId: string
    let testEmailB: string
    const testPassword = 'Password123!'
    let accessToken: string
    let accessTokenB: string
    const razorpaySecret = 'test_razorpay_secret_key_123'

    beforeAll(async () => {
        process.env.RAZORPAY_KEY_ID = 'rzp_test_key_123'
        process.env.RAZORPAY_KEY_SECRET = razorpaySecret

        testEmail = `billingtest-${Date.now()}@example.com`
        testEmailB = `billingtest-b-${Date.now()}@example.com`

        const bcrypt = await import('bcrypt')
        const { env } = await import('../../src/env')
        const hashedPassword = await bcrypt.hash(testPassword, env.BCRYPT_SALT_ROUNDS)

        const user = await prisma.user.create({
            data: {
                name: 'Billing Test User',
                username: `billinguser_${Date.now()}`,
                email: testEmail,
                password: hashedPassword,
                emailVerified: true,
                creditBalance: 1000, // $10 initial balance
            },
        })
        testUserId = user.id

        const userB = await prisma.user.create({
            data: {
                name: 'Billing Test User B',
                username: `billinguser_b_${Date.now()}`,
                email: testEmailB,
                password: hashedPassword,
                emailVerified: true,
                creditBalance: 500, // $5 initial balance
            },
        })
        testUserBId = userB.id

        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const session = await prisma.authSession.create({
            data: {
                userId: testUserId,
                refreshTokenHash: 'test-hash-' + Date.now(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })
        accessToken = generateAccessToken({ userId: testUserId, sessionId: session.id })

        const sessionB = await prisma.authSession.create({
            data: {
                userId: testUserBId,
                refreshTokenHash: 'test-hash-b-' + Date.now(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })
        accessTokenB = generateAccessToken({ userId: testUserBId, sessionId: sessionB.id })
    })

    afterAll(async () => {
        for (const uid of [testUserId, testUserBId]) {
            if (uid) {
                await prisma.notification.deleteMany({ where: { userId: uid } }).catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
                await prisma.redeemCodeClaim.deleteMany({ where: { userId: uid } }).catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
                await prisma.walletTransaction.deleteMany({ where: { userId: uid } }).catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
                await prisma.usageEvent.deleteMany({ where: { userId: uid } }).catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
                await prisma.authSession.deleteMany({ where: { userId: uid } }).catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
                await prisma.user.delete({ where: { id: uid } }).catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
            }
        }
    })

    it('GET /api/v1/billing/overview - returns 401 when unauthorized', async () => {
        const res = await request(app).get('/api/v1/billing/overview')
        expect(res.status).toBe(401)
    })

    it('GET /api/v1/billing/overview - returns overview for authenticated user', async () => {
        const res = await request(app)
            .get('/api/v1/billing/overview')
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.creditBalance).toBe(1000)
        expect(res.body.data.usdToInrRate).toBeDefined()
        expect(res.body.data.usage).toBeDefined()
        expect(res.body.data.transactions).toBeArray()
    })

    it('POST /api/v1/billing/wallet/order/razorpay - rejects amount below minimum ($1.00)', async () => {
        const res = await request(app)
            .post('/api/v1/billing/wallet/order/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ amountInCents: 50 })

        expect(res.status).toBe(400)
    })

    it('POST /api/v1/billing/wallet/order/razorpay - rejects amount above maximum ($50.00 / 5000 cents)', async () => {
        const res = await request(app)
            .post('/api/v1/billing/wallet/order/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ amountInCents: 5001 })

        expect(res.status).toBe(400)
    })

    it('POST /api/v1/billing/wallet/order/razorpay - rejects non-integer amount', async () => {
        const res = await request(app)
            .post('/api/v1/billing/wallet/order/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ amountInCents: 150.5 })

        expect(res.status).toBe(400)
    })

    it('POST /api/v1/billing/wallet/order/razorpay - handles payment gateway 401 authentication error mapped to HTTP 502', async () => {
        const originalOrdersCreate = razorpay.orders.create
        razorpay.orders.create = (async () => {
            const err: any = new Error('Unauthorized')
            err.statusCode = 401
            err.error = { description: 'Authentication failed' }
            throw err
        }) as any

        try {
            const res = await request(app)
                .post('/api/v1/billing/wallet/order/razorpay')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ amountInCents: 1000 })

            expect(res.status).toBe(502)
            expect(res.body.message).toContain('Payment gateway authentication failed')
        } finally {
            razorpay.orders.create = originalOrdersCreate
        }
    })

    it('POST /api/v1/billing/wallet/order/razorpay - handles payment gateway timeout error mapped to HTTP 502', async () => {
        const originalOrdersCreate = razorpay.orders.create
        razorpay.orders.create = (async () => {
            throw new Error('Gateway connection timeout')
        }) as any

        try {
            const res = await request(app)
                .post('/api/v1/billing/wallet/order/razorpay')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ amountInCents: 1000 })

            expect(res.status).toBe(502)
            expect(res.body.message).toContain('Failed to create payment order')
        } finally {
            razorpay.orders.create = originalOrdersCreate
        }
    })

    let createdOrderId = ''

    it('POST /api/v1/billing/wallet/order/razorpay - creates Razorpay order and pending wallet transaction with provider metadata', async () => {
        createdOrderId = `order_${Date.now()}`
        spyOn(razorpay.orders, 'create').mockImplementation((async () => ({
            id: createdOrderId,
            amount: 190520,
            currency: 'INR',
        })) as any)

        const res = await request(app)
            .post('/api/v1/billing/wallet/order/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ amountInCents: 2000 })

        expect(res.status).toBe(201)
        expect(res.body.data.orderId).toBe(createdOrderId)
        expect(res.body.data.keyId).toBe('rzp_test_key_123')
        expect(res.body.data.usdToInrRate).toBeDefined()

        const dbTx = await prisma.walletTransaction.findFirst({
            where: { providerOrderId: createdOrderId },
        })
        expect(dbTx).not.toBeNull()
        expect(dbTx?.status).toBe('PENDING')
        expect(dbTx?.amountInCents).toBe(2000)
        expect(dbTx?.currency).toBe('USD')
        expect(dbTx?.provider).toBe('RAZORPAY')
        expect((dbTx?.metadata as any)?.amountInPaise).toBe(190520)
    })

    it('POST /api/v1/billing/wallet/order/razorpay - respects USD_TO_INR_RATE environment variable override', async () => {
        const customOrderId = `order_rate_override_${Date.now()}`
        const originalEnvRate = process.env.USD_TO_INR_RATE
        process.env.USD_TO_INR_RATE = '100.0'

        let passedAmountInPaise = 0
        const originalOrdersCreate = razorpay.orders.create
        razorpay.orders.create = (async (data: any) => {
            passedAmountInPaise = data.amount
            return {
                id: customOrderId,
                amount: data.amount,
                currency: 'INR',
            }
        }) as any

        try {
            const res = await request(app)
                .post('/api/v1/billing/wallet/order/razorpay')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ amountInCents: 1500 }) // $15 USD

            expect(res.status).toBe(201)
            expect(res.body.data.usdToInrRate).toBe(100.0)
            expect(res.body.data.amount).toBe(150000)
            expect(passedAmountInPaise).toBe(150000)

            const dbTx = await prisma.walletTransaction.findFirst({
                where: { providerOrderId: customOrderId },
            })
            expect(dbTx).not.toBeNull()
            expect(dbTx?.amountInCents).toBe(1500)
            expect((dbTx?.metadata as any)?.usdToInrRate).toBe(100.0)
        } finally {
            razorpay.orders.create = originalOrdersCreate
            if (originalEnvRate !== undefined) {
                process.env.USD_TO_INR_RATE = originalEnvRate
            } else {
                delete process.env.USD_TO_INR_RATE
            }
        }
    })

    it('POST /api/v1/billing/wallet/verify/razorpay - rejects invalid signature', async () => {
        const res = await request(app)
            .post('/api/v1/billing/wallet/verify/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                razorpay_order_id: createdOrderId,
                razorpay_payment_id: 'pay_123',
                razorpay_signature: 'invalid_sig',
            })

        expect(res.status).toBe(400)
    })

    it('POST /api/v1/billing/wallet/verify/razorpay - rejects non-existent order lookup with 404', async () => {
        const fakeOrderId = 'order_non_existent_999'
        const fakePaymentId = 'pay_fake_999'
        const signature = crypto
            .createHmac('sha256', razorpaySecret)
            .update(`${fakeOrderId}|${fakePaymentId}`)
            .digest('hex')

        const res = await request(app)
            .post('/api/v1/billing/wallet/verify/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                razorpay_order_id: fakeOrderId,
                razorpay_payment_id: fakePaymentId,
                razorpay_signature: signature,
            })

        expect(res.status).toBe(404)
        expect(res.body.message).toBe('transaction order not found')
    })

    it('POST /api/v1/billing/wallet/verify/razorpay - rejects cross-user authorization attempt with 403', async () => {
        const paymentId = `pay_cross_${Date.now()}`
        const signature = crypto
            .createHmac('sha256', razorpaySecret)
            .update(`${createdOrderId}|${paymentId}`)
            .digest('hex')

        // User B attempts to verify User A's order
        const res = await request(app)
            .post('/api/v1/billing/wallet/verify/razorpay')
            .set('Authorization', `Bearer ${accessTokenB}`)
            .send({
                razorpay_order_id: createdOrderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
            })

        expect(res.status).toBe(403)
        expect(res.body.message).toBe('unauthorized to verify this transaction')
    })

    it('POST /api/v1/billing/wallet/verify/razorpay - verifies payment, updates status & credit balance, and creates notification', async () => {
        const paymentId = `pay_${Date.now()}`
        const signature = crypto
            .createHmac('sha256', razorpaySecret)
            .update(`${createdOrderId}|${paymentId}`)
            .digest('hex')

        const res = await request(app)
            .post('/api/v1/billing/wallet/verify/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                razorpay_order_id: createdOrderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
            })

        expect(res.status).toBe(200)
        expect(res.body.data.success).toBe(true)
        expect(res.body.data.newBalance).toBe(3000) // 1000 + 2000 = 3000

        const dbTx = await prisma.walletTransaction.findFirst({
            where: { providerOrderId: createdOrderId },
        })
        expect(dbTx?.status).toBe('SUCCESS')

        const notif = await prisma.notification.findFirst({
            where: { userId: testUserId, title: 'Credits Added' },
        })
        expect(notif).not.toBeNull()
        expect(notif?.message).toContain('$20.00')
    })

    it('POST /api/v1/billing/wallet/verify/razorpay - is idempotent on already verified order without double-crediting balance', async () => {
        const userBefore = await prisma.user.findUnique({
            where: { id: testUserId },
            select: { creditBalance: true },
        })

        const paymentId = `pay_dup_${Date.now()}`
        const signature = crypto
            .createHmac('sha256', razorpaySecret)
            .update(`${createdOrderId}|${paymentId}`)
            .digest('hex')

        const res = await request(app)
            .post('/api/v1/billing/wallet/verify/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                razorpay_order_id: createdOrderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
            })

        expect(res.status).toBe(200)
        expect(res.body.data.success).toBe(true)
        expect(res.body.data.alreadyProcessed).toBe(true)

        const userAfter = await prisma.user.findUnique({
            where: { id: testUserId },
            select: { creditBalance: true },
        })
        expect(userAfter?.creditBalance).toBe(userBefore?.creditBalance)
    })

    it('POST /api/v1/billing/wallet/verify/razorpay - recovers and fulfills order previously marked FAILED by failed attempt', async () => {
        const failedOrderId = `order_failed_then_retry_${Date.now()}`
        const retryPaymentId = `pay_retry_${Date.now()}`

        // Create transaction in FAILED status (simulating first attempt failure)
        await prisma.walletTransaction.create({
            data: {
                userId: testUserId,
                amountInCents: 2000,
                currency: 'USD',
                provider: 'RAZORPAY',
                providerOrderId: failedOrderId,
                status: 'FAILED',
            },
        })

        const retrySignature = crypto
            .createHmac('sha256', razorpaySecret)
            .update(`${failedOrderId}|${retryPaymentId}`)
            .digest('hex')

        const res = await request(app)
            .post('/api/v1/billing/wallet/verify/razorpay')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                razorpay_order_id: failedOrderId,
                razorpay_payment_id: retryPaymentId,
                razorpay_signature: retrySignature,
            })

        expect(res.status).toBe(200)
        expect(res.body.data.success).toBe(true)
        expect(res.body.data.newBalance).toBe(5000) // 3000 + 2000 = 5000

        const dbTx = await prisma.walletTransaction.findFirst({
            where: { providerOrderId: failedOrderId },
        })
        expect(dbTx?.status).toBe('SUCCESS')
        expect(dbTx?.providerPaymentId).toBe(retryPaymentId)
    })

    it('GET /api/v1/billing/credits/history - returns usage and credit history', async () => {
        const res = await request(app)
            .get('/api/v1/billing/credits/history?limit=10&offset=0')
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.events).toBeArray()
        expect(res.body.data.limit).toBe(10)
    })

    it('POST /api/v1/billing/credits/add - returns 404 as dead route is removed', async () => {
        const res = await request(app)
            .post('/api/v1/billing/credits/add')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                amountInCents: 2500,
                paymentMethod: 'card',
            })

        expect(res.status).toBe(404)
    })

    it('POST /api/v1/billing/redeem-code - redeems a valid code and increases balance', async () => {
        const rawCode = `TESTGIFT-${Date.now()}`
        const codeHash = crypto.createHash('sha256').update(rawCode.toUpperCase()).digest('hex')

        const redeemCode = await prisma.redeemCode.create({
            data: {
                codeHash,
                creditAmount: 1500,
                maxRedemptions: 5,
                metadata: { code: rawCode },
            },
        })

        const res = await request(app)
            .post('/api/v1/billing/redeem-code')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ code: rawCode })

        expect(res.status).toBe(200)
        expect(res.body.data.creditAmount).toBe(1500)
        expect(res.body.data.newBalance).toBe(6500) // 5000 + 1500 = 6500

        // Attempting to redeem the same code again returns 409
        const duplicateRes = await request(app)
            .post('/api/v1/billing/redeem-code')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ code: rawCode })

        expect(duplicateRes.status).toBe(409)
        expect(duplicateRes.body.message).toBe('you have already redeemed this code')

        // Cleanup redeem code
        await prisma.redeemCodeClaim.deleteMany({ where: { redeemCodeId: redeemCode.id } })
        await prisma.redeemCode.delete({ where: { id: redeemCode.id } })
    })

    it('POST /api/v1/billing/redeem-code - handles zero-width spaces correctly', async () => {
        const rawCode = `ZWSPGIFT-${Date.now()}`
        const codeHash = crypto.createHash('sha256').update(rawCode.toUpperCase()).digest('hex')

        const redeemCode = await prisma.redeemCode.create({
            data: {
                codeHash,
                creditAmount: 500,
                maxRedemptions: 1,
            },
        })

        // Send with zero-width space in the middle and BOM at start
        const res = await request(app)
            .post('/api/v1/billing/redeem-code')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ code: `\uFEFF${rawCode.slice(0, 4)}\u200B${rawCode.slice(4)} ` })

        expect(res.status).toBe(200)
        expect(res.body.data.creditAmount).toBe(500)

        // Cleanup
        await prisma.redeemCodeClaim.deleteMany({ where: { redeemCodeId: redeemCode.id } })
        await prisma.redeemCode.delete({ where: { id: redeemCode.id } })
    })

    it('POST /api/v1/billing/redeem-code - case-insensitively redeems code', async () => {
        const rawCode = `PROMO${Date.now()}`
        const codeHash = crypto.createHash('sha256').update(rawCode.toUpperCase()).digest('hex')

        const redeemCode = await prisma.redeemCode.create({
            data: {
                codeHash,
                creditAmount: 800,
                maxRedemptions: 5,
            },
        })

        // Send with lowercase code
        const res = await request(app)
            .post('/api/v1/billing/redeem-code')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ code: rawCode.toLowerCase() })

        expect(res.status).toBe(200)
        expect(res.body.data.creditAmount).toBe(800)

        // Cleanup
        await prisma.redeemCodeClaim.deleteMany({ where: { redeemCodeId: redeemCode.id } })
        await prisma.redeemCode.delete({ where: { id: redeemCode.id } })
    })

    it('POST /api/v1/billing/redeem-code - rejects expired codes with 400', async () => {
        const rawCode = `EXPIRED-${Date.now()}`
        const codeHash = crypto.createHash('sha256').update(rawCode.toUpperCase()).digest('hex')

        const redeemCode = await prisma.redeemCode.create({
            data: {
                codeHash,
                creditAmount: 1000,
                expiresAt: new Date(Date.now() - 3600 * 1000), // expired 1 hour ago
            },
        })

        const res = await request(app)
            .post('/api/v1/billing/redeem-code')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ code: rawCode })

        expect(res.status).toBe(400)
        expect(res.body.message).toBe('this redeem code has expired')

        // Cleanup
        await prisma.redeemCode.delete({ where: { id: redeemCode.id } })
    })

    it('POST /api/v1/billing/redeem-code - rejects code that reached max redemptions with 400', async () => {
        const rawCode = `MAXED-${Date.now()}`
        const codeHash = crypto.createHash('sha256').update(rawCode.toUpperCase()).digest('hex')

        const redeemCode = await prisma.redeemCode.create({
            data: {
                codeHash,
                creditAmount: 1000,
                maxRedemptions: 1,
                redemptionCount: 1, // already at max
            },
        })

        const res = await request(app)
            .post('/api/v1/billing/redeem-code')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ code: rawCode })

        expect(res.status).toBe(400)
        expect(res.body.message).toBe('this redeem code has reached its maximum redemptions')

        // Cleanup
        await prisma.redeemCode.delete({ where: { id: redeemCode.id } })
    })

    it('POST /api/v1/billing/redeem-code - rejects non-existent code with 404', async () => {
        const res = await request(app)
            .post('/api/v1/billing/redeem-code')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ code: 'COMPLETELY_INVALID_CODE_999' })

        expect(res.status).toBe(404)
        expect(res.body.message).toBe('invalid or expired redeem code')
    })

    it('POST /api/v1/billing/redeem-code - rejects empty or whitespace code with 400', async () => {
        const res = await request(app)
            .post('/api/v1/billing/redeem-code')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ code: '   ' })

        expect(res.status).toBe(400)
    })

    it('POST /api/v1/billing/webhook/razorpay - rejects missing or invalid signature', async () => {
        process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_key'

        const res = await request(app)
            .post('/api/v1/billing/webhook/razorpay')
            .send({ event: 'payment.captured' })

        expect(res.status).toBe(400)
    })

    it('POST /api/v1/billing/webhook/razorpay - processes valid payment.captured webhook and is idempotent', async () => {
        const webhookSecret = 'test_webhook_secret_key'
        process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret

        const webhookOrderId = `order_wh_${Date.now()}`
        const webhookPaymentId = `pay_wh_${Date.now()}`

        // Create pending transaction
        await prisma.walletTransaction.create({
            data: {
                userId: testUserId,
                amountInCents: 2000,
                currency: 'USD',
                provider: 'RAZORPAY',
                providerOrderId: webhookOrderId,
                status: 'PENDING',
            },
        })

        const payload = {
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: webhookPaymentId,
                        order_id: webhookOrderId,
                        amount: 190520,
                    },
                },
            },
        }

        const rawBody = JSON.stringify(payload)
        const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')

        const res = await request(app)
            .post('/api/v1/billing/webhook/razorpay')
            .set('x-razorpay-signature', signature)
            .send(payload)

        expect(res.status).toBe(200)
        expect(res.body.data.status).toBe('processed')

        const dbTx = await prisma.walletTransaction.findFirst({
            where: { providerOrderId: webhookOrderId },
        })
        expect(dbTx?.status).toBe('SUCCESS')
        expect(dbTx?.providerPaymentId).toBe(webhookPaymentId)

        // Repeat webhook call - verify idempotency
        const resDup = await request(app)
            .post('/api/v1/billing/webhook/razorpay')
            .set('x-razorpay-signature', signature)
            .send(payload)

        expect(resDup.status).toBe(200)
        expect(resDup.body.data.status).toBe('already_processed')
    })

    it('POST /api/v1/billing/webhook/razorpay - gracefully handles payment.failed event', async () => {
        const webhookSecret = 'test_webhook_secret_key'
        process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret

        const webhookFailOrderId = `order_wh_fail_${Date.now()}`
        const webhookFailPaymentId = `pay_wh_fail_${Date.now()}`

        // Create pending transaction
        await prisma.walletTransaction.create({
            data: {
                userId: testUserId,
                amountInCents: 1500,
                currency: 'USD',
                provider: 'RAZORPAY',
                providerOrderId: webhookFailOrderId,
                status: 'PENDING',
            },
        })

        const payload = {
            event: 'payment.failed',
            payload: {
                payment: {
                    entity: {
                        id: webhookFailPaymentId,
                        order_id: webhookFailOrderId,
                        error_description: 'Payment was declined by issuing bank',
                    },
                },
            },
        }

        const rawBody = JSON.stringify(payload)
        const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')

        const res = await request(app)
            .post('/api/v1/billing/webhook/razorpay')
            .set('x-razorpay-signature', signature)
            .send(payload)

        expect(res.status).toBe(200)
        expect(res.body.data.status).toBe('failed_recorded')

        const dbTx = await prisma.walletTransaction.findFirst({
            where: { providerOrderId: webhookFailOrderId },
        })
        expect(dbTx?.status).toBe('FAILED')
        expect(dbTx?.providerPaymentId).toBe(webhookFailPaymentId)
        expect((dbTx?.metadata as any)?.error).toBe('Payment was declined by issuing bank')
    })
})
