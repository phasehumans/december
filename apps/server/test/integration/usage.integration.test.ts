import crypto from 'crypto'

import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { razorpay } from '../../src/config/razorpay'
import { usageService } from '../../src/modules/usage/usage.service'
import { cleanupTestUser, getRandomIP } from '../helpers'

describe('Usage Module Integration Tests', () => {
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

        const timestamp = Date.now()
        testEmail = `usagetest-${timestamp}@example.com`
        testEmailB = `usagetest-b-${timestamp}@example.com`

        const bcrypt = await import('bcrypt')
        const { env } = await import('../../src/env')
        const hashedPassword = await bcrypt.hash(testPassword, env.BCRYPT_SALT_ROUNDS)

        const user = await prisma.user.create({
            data: {
                name: 'Usage Test User',
                username: `usage_${timestamp}`,
                email: testEmail,
                password: hashedPassword,
                emailVerified: true,
                creditBalance: 500, // 500 cents = $5.00
            },
        })
        testUserId = user.id

        const userB = await prisma.user.create({
            data: {
                name: 'Usage Test User B',
                username: `usage_b_${timestamp}`,
                email: testEmailB,
                password: hashedPassword,
                emailVerified: true,
                creditBalance: 200, // 200 cents = $2.00
            },
        })
        testUserBId = userB.id

        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const session = await prisma.authSession.create({
            data: {
                userId: testUserId,
                refreshTokenHash: `usage-hash-${timestamp}`,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })
        accessToken = generateAccessToken({ userId: testUserId, sessionId: session.id })

        const sessionB = await prisma.authSession.create({
            data: {
                userId: testUserBId,
                refreshTokenHash: `usage-hash-b-${timestamp}`,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })
        accessTokenB = generateAccessToken({ userId: testUserBId, sessionId: sessionB.id })
    })

    afterAll(async () => {
        for (const uid of [testUserId, testUserBId]) {
            if (uid) {
                await prisma.notification.deleteMany({ where: { userId: uid } }).catch(() => {})
                await prisma.walletTransaction
                    .deleteMany({ where: { userId: uid } })
                    .catch(() => {})
                await prisma.usageEvent.deleteMany({ where: { userId: uid } }).catch(() => {})
                await prisma.authSession.deleteMany({ where: { userId: uid } }).catch(() => {})
                await cleanupTestUser({ id: uid })
            }
        }
    })

    describe('HTTP Endpoints (/api/v1/usage)', () => {
        it('1. GET /api/v1/usage - unauthorized without token (401)', async () => {
            const res = await request(app)
                .get('/api/v1/usage')
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(401)
        })

        it('2. GET /api/v1/usage - returns current usage, UTC month boundaries, and credit balance', async () => {
            const res = await request(app)
                .get('/api/v1/usage')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.data.credits.remainingInCents).toBe(500)
            expect(res.body.data.usage).toBeDefined()

            const periodStart = new Date(res.body.data.periodStart)
            const periodEnd = new Date(res.body.data.periodEnd)
            expect(periodStart.getUTCDate()).toBe(1)
            expect(periodEnd.getUTCDate()).toBe(1)
            expect(periodEnd.getTime()).toBeGreaterThan(periodStart.getTime())
        })

        it('3. GET /api/v1/usage/check - checks enough credits with estimatedCostInCents parameter parsing', async () => {
            const res = await request(app)
                .get('/api/v1/usage/check?estimatedCostInCents=100')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.data.enoughCredits).toBe(true)
            expect(res.body.data.estimatedCostInCents).toBe(100)
        })

        it('4. GET /api/v1/usage/check - returns enoughCredits false when estimate exceeds balance', async () => {
            const res = await request(app)
                .get('/api/v1/usage/check?estimatedCostInCents=10000')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.data.enoughCredits).toBe(false)
        })

        it('5. GET /api/v1/usage/check - handles string coercion and default 0 estimated cost', async () => {
            const res = await request(app)
                .get('/api/v1/usage/check')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.data.enoughCredits).toBe(true)
            expect(res.body.data.estimatedCostInCents).toBe(0)
        })

        it('6. GET /api/v1/usage/check - returns enoughCredits false for zero or negative balance scenarios', async () => {
            // Set user balance to 0
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 0 },
            })

            const resZero = await request(app)
                .get('/api/v1/usage/check?estimatedCostInCents=50')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)

            expect(resZero.status).toBe(200)
            expect(resZero.body.data.enoughCredits).toBe(false)

            // Set user balance to negative overdraft (-20 cents)
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: -20 },
            })

            const resNeg = await request(app)
                .get('/api/v1/usage/check?estimatedCostInCents=0')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)

            expect(resNeg.status).toBe(200)
            expect(resNeg.body.data.enoughCredits).toBe(false)

            // Reset balance back to 500 cents
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 500 },
            })
        })
    })

    describe('usageService.recordUsageEvent', () => {
        it('atomically deducts token cost from user.creditBalance in database', async () => {
            const initialUser = await prisma.user.findUnique({ where: { id: testUserId } })
            const initialBalance = initialUser!.creditBalance

            // Record an event with gpt-4o: 10,000 input, 10,000 output
            // Input rate: $2.50 / 1M = 0.025 cents/token -> 10,000 = 2.5 cents
            // Output rate: $10.00 / 1M = 0.1 cents/token -> 10,000 = 10.0 cents
            // Total cost = 12.5 cents
            const result = await usageService.recordUsageEvent({
                userId: testUserId,
                model: 'gpt-4o',
                inputTokens: 10000,
                outputTokens: 10000,
                totalTokens: 20000,
            })

            expect(result.idempotent).toBe(false)
            expect(result.event.costInCents).toBe(12.5)

            const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } })
            expect(updatedUser!.creditBalance).toBe(initialBalance - 12.5)
        })

        it('supports sub-cent precision with micro-cent resolution (6 decimal places)', async () => {
            const initialUser = await prisma.user.findUnique({ where: { id: testUserId } })
            const initialBalance = initialUser!.creditBalance

            // gemini-3.6-flash: input 0.1 / 10000 cents/token
            // 15 tokens = 0.00015 cents
            const result = await usageService.recordUsageEvent({
                userId: testUserId,
                model: 'gemini-3.6-flash',
                inputTokens: 15,
                outputTokens: 0,
                totalTokens: 15,
            })

            expect(result.idempotent).toBe(false)
            expect(result.event.costInCents).toBe(0.00015)

            const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } })
            expect(updatedUser!.creditBalance).toBeCloseTo(initialBalance - 0.00015, 5)
        })

        it('handles soft overdraft allowing user balance to transition into negative', async () => {
            // Set user balance to 2 cents
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 2 },
            })

            // Run generation that costs 5 cents (gpt-4o: 4000 input tokens = 1.0c, 4000 output tokens = 4.0c -> 5.0c)
            const result = await usageService.recordUsageEvent({
                userId: testUserId,
                model: 'gpt-4o',
                inputTokens: 4000,
                outputTokens: 4000,
                totalTokens: 8000,
            })

            expect(result.idempotent).toBe(false)
            expect(result.event.costInCents).toBe(5)

            const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } })
            // Balance transitioned from 2 to -3 cents
            expect(updatedUser!.creditBalance).toBe(-3)

            // Reset balance for subsequent tests
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 500 },
            })
        })

        it('guarantees idempotency when called repeatedly with same externalRequestId without double-deducting', async () => {
            const externalRequestId = `ext_req_${Date.now()}`

            const firstResult = await usageService.recordUsageEvent({
                userId: testUserId,
                model: 'gpt-4o',
                inputTokens: 1000,
                outputTokens: 1000,
                totalTokens: 2000,
                externalRequestId,
            })

            expect(firstResult.idempotent).toBe(false)
            const balanceAfterFirst = (await prisma.user.findUnique({ where: { id: testUserId } }))!
                .creditBalance

            // Second call with same externalRequestId
            const secondResult = await usageService.recordUsageEvent({
                userId: testUserId,
                model: 'gpt-4o',
                inputTokens: 1000,
                outputTokens: 1000,
                totalTokens: 2000,
                externalRequestId,
            })

            expect(secondResult.idempotent).toBe(true)
            expect(secondResult.event.id).toBe(firstResult.event.id)

            const balanceAfterSecond = (await prisma.user.findUnique({
                where: { id: testUserId },
            }))!.creditBalance
            expect(balanceAfterSecond).toBe(balanceAfterFirst) // No double-deduction
        })

        it('rejects cross-user collision with 409 conflict when externalRequestId belongs to different user', async () => {
            const externalRequestId = `ext_cross_${Date.now()}`

            // Recorded for User A
            await usageService.recordUsageEvent({
                userId: testUserId,
                model: 'gpt-4o',
                inputTokens: 500,
                outputTokens: 500,
                totalTokens: 1000,
                externalRequestId,
            })

            // Attempted by User B with same externalRequestId
            await expect(
                usageService.recordUsageEvent({
                    userId: testUserBId,
                    model: 'gpt-4o',
                    inputTokens: 500,
                    outputTokens: 500,
                    totalTokens: 1000,
                    externalRequestId,
                })
            ).rejects.toThrow('external request id already exists')
        })
    })

    describe('Service Balance Checks', () => {
        it('hasMinimumBalance verifies configurable minimum thresholds', async () => {
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 50 },
            })

            const has1Cent = await usageService.hasMinimumBalance({ userId: testUserId })
            expect(has1Cent).toBe(true)

            const has50Cents = await usageService.hasMinimumBalance({
                userId: testUserId,
                minBalanceInCents: 50,
            })
            expect(has50Cents).toBe(true)

            const has100Cents = await usageService.hasMinimumBalance({
                userId: testUserId,
                minBalanceInCents: 100,
            })
            expect(has100Cents).toBe(false)
        })

        it('canRunSelfCorrection checks against credit threshold', async () => {
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 10 },
            })

            const canRun = await usageService.canRunSelfCorrection({ userId: testUserId })
            expect(canRun).toBe(true)

            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 3 }, // below default 5 cents threshold
            })

            const cannotRun = await usageService.canRunSelfCorrection({ userId: testUserId })
            expect(cannotRun).toBe(false)
        })
    })

    describe('End-to-End Workflow Verification', () => {
        it('E2E Wallet Top-Up Flow: order creation -> verification -> balance update reflected in /overview and /usage', async () => {
            // Initial balance setup
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 1000 }, // $10.00
            })

            const orderId = `e2e_order_${Date.now()}`
            spyOn(razorpay.orders, 'create').mockImplementation((async () => ({
                id: orderId,
                amount: 190520,
                currency: 'INR',
            })) as any)

            // Step 1: Create top-up order for $20.00 (2000 cents)
            const orderRes = await request(app)
                .post('/api/v1/billing/wallet/order/razorpay')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ amountInCents: 2000 })

            expect(orderRes.status).toBe(201)
            expect(orderRes.body.data.orderId).toBe(orderId)

            // Step 2: Verify payment with valid signature
            const paymentId = `e2e_pay_${Date.now()}`
            const signature = crypto
                .createHmac('sha256', razorpaySecret)
                .update(`${orderId}|${paymentId}`)
                .digest('hex')

            const verifyRes = await request(app)
                .post('/api/v1/billing/wallet/verify/razorpay')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    razorpay_order_id: orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: signature,
                })

            expect(verifyRes.status).toBe(200)
            expect(verifyRes.body.data.success).toBe(true)
            expect(verifyRes.body.data.newBalance).toBe(3000) // 1000 + 2000

            // Step 3: Check billing overview reflects updated balance and new transaction
            const overviewRes = await request(app)
                .get('/api/v1/billing/overview')
                .set('Authorization', `Bearer ${accessToken}`)

            expect(overviewRes.status).toBe(200)
            expect(overviewRes.body.data.creditBalance).toBe(3000)
            const hasTx = overviewRes.body.data.transactions.some(
                (tx: any) => tx.amountInCents === 2000 && tx.status === 'SUCCESS'
            )
            expect(hasTx).toBe(true)

            // Step 4: Check usage endpoint reflects updated balance
            const usageRes = await request(app)
                .get('/api/v1/usage')
                .set('Authorization', `Bearer ${accessToken}`)

            expect(usageRes.status).toBe(200)
            expect(usageRes.body.data.credits.remainingInCents).toBe(3000)
        })

        it('E2E Token Deduction Flow: generation -> recordUsageEvent -> balance deducted and reflected in /usage and /billing/overview', async () => {
            // Initial balance at 3000 cents
            await prisma.user.update({
                where: { id: testUserId },
                data: { creditBalance: 3000 },
            })

            // Step 1: Simulate LLM generation recording usage event
            // gpt-4o: 2000 input tokens (0.5 cents) + 2000 output tokens (2.0 cents) = 2.5 cents
            const recordResult = await usageService.recordUsageEvent({
                userId: testUserId,
                model: 'gpt-4o',
                inputTokens: 2000,
                outputTokens: 2000,
                totalTokens: 4000,
                externalRequestId: `e2e_llm_${Date.now()}`,
            })

            expect(recordResult.idempotent).toBe(false)
            expect(recordResult.event.costInCents).toBe(2.5)

            // Step 2: Verify deduction reflected in GET /api/v1/usage
            const usageRes = await request(app)
                .get('/api/v1/usage')
                .set('Authorization', `Bearer ${accessToken}`)

            expect(usageRes.status).toBe(200)
            // 3000 - 2.5 = 2997.5 cents
            expect(usageRes.body.data.credits.remainingInCents).toBe(2997.5)
            expect(usageRes.body.data.usage.totalTokens).toBeGreaterThanOrEqual(4000)

            // Step 3: Verify deduction reflected in GET /api/v1/billing/overview
            const overviewRes = await request(app)
                .get('/api/v1/billing/overview')
                .set('Authorization', `Bearer ${accessToken}`)

            expect(overviewRes.status).toBe(200)
            expect(overviewRes.body.data.creditBalance).toBe(2997.5)
            expect(overviewRes.body.data.usage.totalTokens).toBeGreaterThanOrEqual(4000)
            expect(overviewRes.body.data.usage.costInCents).toBeGreaterThanOrEqual(2.5)
        })
    })
})
