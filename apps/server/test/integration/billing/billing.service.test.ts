import '../../env'

import crypto from 'crypto'
import { prisma } from '@december/database'
import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

const sendNotificationMock = mock(async () => ({}))

mock.module('../../../src/modules/notification/notification.service', () => ({
    sendNotificationToUser: sendNotificationMock,
}))

import { razorpay } from '../../../src/config/razorpay'
import { billingService } from '../../../src/modules/billing/billing.service'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Billing Test User',
            email: `billing-${crypto.randomUUID()}@example.com`,
            username: `billing-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            creditBalance: 100,
            ...overrides,
        },
    })
}

describe('billing.service.integration', () => {
    let isCleaningUp = false

    beforeEach(async () => {
        if (isCleaningUp) return
        sendNotificationMock.mockClear()

        process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
        process.env.RAZORPAY_KEY_SECRET = 'razorpay_test_secret'
        ;(razorpay.orders as any).create = async (options: any) => ({
            id: `order_${crypto.randomUUID()}`,
            amount: options.amount,
            currency: options.currency,
        })

        await prisma.walletTransaction.deleteMany()
        await prisma.usageEvent.deleteMany()
        await prisma.redeemCodeClaim.deleteMany()
        await prisma.redeemCode.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    afterAll(async () => {
        isCleaningUp = true
        await prisma.$disconnect()
    }, 15000)

    describe('getOverview', () => {
        it('should return correct overview data for valid user', async () => {
            const user = await createUser({ creditBalance: 250 })

            // Add usage events
            await prisma.usageEvent.createMany({
                data: [
                    {
                        userId: user.id,
                        model: 'gpt-4',
                        inputTokens: 100,
                        outputTokens: 50,
                        totalTokens: 150,
                        costInCents: 5,
                        periodStart: new Date(),
                        periodEnd: new Date(),
                    },
                    {
                        userId: user.id,
                        model: 'gpt-4',
                        inputTokens: 200,
                        outputTokens: 100,
                        totalTokens: 300,
                        costInCents: 10,
                        periodStart: new Date(),
                        periodEnd: new Date(),
                    },
                ],
            })

            const result = await billingService.getOverview({ userId: user.id })

            expect(result.creditBalance).toBe(250)
            expect(result.usage.costInCents).toBe(15) // 5 + 10
            expect(result.usage.totalTokens).toBe(450)
            expect(result.claims.length).toBe(0)
            expect(result.transactions.length).toBe(0)
        })

        it('should throw if user not found', async () => {
            let error: any = null
            try {
                await billingService.getOverview({ userId: 'fake-id' })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
            expect(error.message).toBe('user not found')
        })
    })

    describe('createRazorpayOrder', () => {
        it('should create order and wallet transaction', async () => {
            const user = await createUser()

            const result = await billingService.createRazorpayOrder({
                userId: user.id,
                amountInCents: 500,
                currency: 'USD',
            })

            expect(result.keyId).toBe('rzp_test_key')
            expect(result.orderId).toContain('order_')
            expect(result.amount).toBe(500 * 84) // 84 is the USD_TO_INR_RATE
            expect(result.currency).toBe('INR') // Razorpay order is in INR

            const transaction = await prisma.walletTransaction.findFirst({
                where: { providerOrderId: result.orderId },
            })

            expect(transaction).not.toBeNull()
            expect(transaction!.amountInCents).toBe(500)
            expect(transaction!.status).toBe('PENDING')
        })
    })

    describe('verifyRazorpayPayment', () => {
        it('should verify signature, update balance, and send notification', async () => {
            const user = await createUser({ creditBalance: 100 })
            const orderResult = await billingService.createRazorpayOrder({
                userId: user.id,
                amountInCents: 500,
                currency: 'USD',
            })

            const paymentId = 'pay_test_123'
            const signature = crypto
                .createHmac('sha256', 'razorpay_test_secret')
                .update(`${orderResult.orderId}|${paymentId}`)
                .digest('hex')

            const result = await billingService.verifyRazorpayPayment({
                userId: user.id,
                razorpay_order_id: orderResult.orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
            })

            expect(result.success).toBe(true)
            expect(result.newBalance).toBe(600) // 100 + 500

            const transaction = await prisma.walletTransaction.findFirst({
                where: { providerOrderId: orderResult.orderId },
            })
            expect(transaction!.status).toBe('SUCCESS')

            expect(sendNotificationMock).toHaveBeenCalledTimes(1)
        })

        it('should throw if signature is invalid', async () => {
            const user = await createUser()
            const orderResult = await billingService.createRazorpayOrder({
                userId: user.id,
                amountInCents: 500,
                currency: 'USD',
            })

            let error: any = null
            try {
                await billingService.verifyRazorpayPayment({
                    userId: user.id,
                    razorpay_order_id: orderResult.orderId,
                    razorpay_payment_id: 'pay_test_123',
                    razorpay_signature: 'invalid_sig',
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid razorpay signature')
        })

        it('should throw if transaction not found', async () => {
            const user = await createUser()
            const paymentId = 'pay_test_123'
            const signature = crypto
                .createHmac('sha256', 'razorpay_test_secret')
                .update(`fake_order|${paymentId}`)
                .digest('hex')

            let error: any = null
            try {
                await billingService.verifyRazorpayPayment({
                    userId: user.id,
                    razorpay_order_id: 'fake_order',
                    razorpay_payment_id: paymentId,
                    razorpay_signature: signature,
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('transaction order not found')
        })

        it('should throw if user is unauthorized', async () => {
            const user1 = await createUser()
            const user2 = await createUser()

            const orderResult = await billingService.createRazorpayOrder({
                userId: user1.id,
                amountInCents: 500,
                currency: 'USD',
            })

            const paymentId = 'pay_test_123'
            const signature = crypto
                .createHmac('sha256', 'razorpay_test_secret')
                .update(`${orderResult.orderId}|${paymentId}`)
                .digest('hex')

            let error: any = null
            try {
                await billingService.verifyRazorpayPayment({
                    userId: user2.id, // Different user
                    razorpay_order_id: orderResult.orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: signature,
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('unauthorized to verify this transaction')
        })

        it('should return alreadyProcessed if transaction is already SUCCESS', async () => {
            const user = await createUser()
            const orderResult = await billingService.createRazorpayOrder({
                userId: user.id,
                amountInCents: 500,
                currency: 'USD',
            })

            const paymentId = 'pay_test_123'
            const signature = crypto
                .createHmac('sha256', 'razorpay_test_secret')
                .update(`${orderResult.orderId}|${paymentId}`)
                .digest('hex')

            await billingService.verifyRazorpayPayment({
                userId: user.id,
                razorpay_order_id: orderResult.orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
            })

            // Second call
            const result2 = await billingService.verifyRazorpayPayment({
                userId: user.id,
                razorpay_order_id: orderResult.orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
            })

            expect(result2.success).toBe(true)
            expect(result2.alreadyProcessed).toBe(true)

            // Balance shouldn't increment twice
            const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
            expect(updatedUser!.creditBalance).toBe(600)

            // Notification only sent once
            expect(sendNotificationMock).toHaveBeenCalledTimes(1)
        })
    })

    describe('getCreditsHistory', () => {
        it('should paginate and filter events', async () => {
            const user = await createUser()

            const baseDate = new Date('2026-06-01T00:00:00Z')

            for (let i = 0; i < 5; i++) {
                await prisma.usageEvent.create({
                    data: {
                        userId: user.id,
                        model: 'gpt-4',
                        inputTokens: 10,
                        outputTokens: 10,
                        totalTokens: 20,
                        costInCents: 10 * (i + 1),
                        periodStart: new Date(baseDate.getTime() + i * 1000),
                        periodEnd: new Date(baseDate.getTime() + (i + 1) * 1000),
                        createdAt: new Date(baseDate.getTime() + i * 1000),
                    },
                })
            }

            const result = await billingService.getCreditsHistory({
                userId: user.id,
                limit: 2,
                offset: 1,
            })

            expect(result.events.length).toBe(2)
            expect(result.total).toBe(5)
            expect(result.periods.length).toBe(2)
        })

        it('should filter by periodStart and periodEnd', async () => {
            const user = await createUser()

            const start = new Date('2026-06-01T00:00:00Z')
            const middle = new Date('2026-06-05T00:00:00Z')
            const end = new Date('2026-06-10T00:00:00Z')

            await prisma.usageEvent.create({
                data: {
                    userId: user.id,
                    model: 'gpt-4',
                    inputTokens: 10,
                    outputTokens: 10,
                    totalTokens: 20,
                    costInCents: 10,
                    periodStart: start,
                    periodEnd: start,
                    createdAt: start,
                },
            })

            await prisma.usageEvent.create({
                data: {
                    userId: user.id,
                    model: 'gpt-4',
                    inputTokens: 10,
                    outputTokens: 10,
                    totalTokens: 20,
                    costInCents: 20,
                    periodStart: end,
                    periodEnd: end,
                    createdAt: end,
                },
            })

            const result = await billingService.getCreditsHistory({
                userId: user.id,
                limit: 10,
                offset: 0,
                periodStart: middle.toISOString(),
            })

            expect(result.events.length).toBe(1)
            expect(result.events[0].costInCents).toBe(20)
        })
    })

    describe('redeemCode', () => {
        it('should successfully redeem a valid code and send notification', async () => {
            const user = await createUser({ creditBalance: 100 })
            const code = 'GIFT-100'
            const codeHash = crypto.createHash('sha256').update(code).digest('hex')

            await prisma.redeemCode.create({
                data: {
                    codeHash,
                    creditAmount: 1000,
                    redemptionCount: 0,
                    maxRedemptions: 5,
                },
            })

            const result = await billingService.redeemCode({ userId: user.id, code })

            expect(result.creditAmount).toBe(1000)
            expect(result.newBalance).toBe(1100) // 100 + 1000
            expect(sendNotificationMock).toHaveBeenCalledTimes(1)
        })

        it('should throw if code is empty', async () => {
            const user = await createUser()
            let error: any = null
            try {
                await billingService.redeemCode({ userId: user.id, code: '   ' })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
            expect(error.message).toBe('redeem code cannot be empty')
        })

        it('should throw if code is invalid', async () => {
            const user = await createUser()
            let error: any = null
            try {
                await billingService.redeemCode({ userId: user.id, code: 'INVALID' })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid or expired redeem code')
        })

        it('should throw if code is expired', async () => {
            const user = await createUser()
            const code = 'EXPIRED'
            const codeHash = crypto.createHash('sha256').update(code).digest('hex')

            await prisma.redeemCode.create({
                data: {
                    codeHash,
                    creditAmount: 500,
                    expiresAt: new Date(Date.now() - 10000), // Expired
                    redemptionCount: 0,
                },
            })

            let error: any = null
            try {
                await billingService.redeemCode({ userId: user.id, code })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
            expect(error.message).toBe('this redeem code has expired')
        })

        it('should throw if max redemptions reached', async () => {
            const user = await createUser()
            const code = 'MAXED'
            const codeHash = crypto.createHash('sha256').update(code).digest('hex')

            await prisma.redeemCode.create({
                data: {
                    codeHash,
                    creditAmount: 500,
                    redemptionCount: 2,
                    maxRedemptions: 2,
                },
            })

            let error: any = null
            try {
                await billingService.redeemCode({ userId: user.id, code })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
            expect(error.message).toBe('this redeem code has reached its maximum redemptions')
        })

        it('should throw if already redeemed by user', async () => {
            const user = await createUser()
            const code = 'ALREADY_REDEEMED'
            const codeHash = crypto.createHash('sha256').update(code).digest('hex')

            const dbCode = await prisma.redeemCode.create({
                data: {
                    codeHash,
                    creditAmount: 500,
                    redemptionCount: 1,
                },
            })

            await prisma.redeemCodeClaim.create({
                data: {
                    userId: user.id,
                    redeemCodeId: dbCode.id,
                },
            })

            let error: any = null
            try {
                await billingService.redeemCode({ userId: user.id, code })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
            expect(error.message).toBe('you have already redeemed this code')
        })
    })

    describe('addCredits', () => {
        it('should increment balance and send notification', async () => {
            const user = await createUser({ creditBalance: 100 })

            const result = await billingService.addCredits({
                userId: user.id,
                amountInCents: 500,
                paymentMethod: 'card',
            })

            expect(result.amountInCents).toBe(500)
            expect(result.newBalance).toBe(600)
            expect(sendNotificationMock).toHaveBeenCalledTimes(1)
        })

        it('should throw if user not found', async () => {
            let error: any = null
            try {
                await billingService.addCredits({
                    userId: 'fake-user-id',
                    amountInCents: 500,
                    paymentMethod: 'card',
                })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
            expect(error.message).toBe('user not found')
        })
    })
})
