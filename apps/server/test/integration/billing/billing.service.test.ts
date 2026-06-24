import '../../env'

import { prisma } from '@december/database'
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import crypto from 'crypto'

import { razorpay } from '../../../src/config/razorpay'
import { billingService } from '../../../src/modules/billing/billing.service'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Billing User',
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
    let userId: string

    beforeEach(async () => {
        process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
        process.env.RAZORPAY_KEY_SECRET = 'razorpay_test_secret'
        process.env.COINBASE_API_KEY = 'coinbase_test_key'
        process.env.COINBASE_WEBHOOK_SECRET = 'coinbase_webhook_secret'
        ;(razorpay.orders as any).create = async (options: any) => ({
            id: 'order_test_123',
            amount: options.amount,
            currency: options.currency,
        })

        await prisma.walletTransaction.deleteMany()
        await prisma.usageEvent.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        const user = await createUser()
        userId = user.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it('should return billing overview', async () => {
        const result = await billingService.getOverview({ userId })

        expect(result.creditBalance).toBe(100)
        expect(result.giftedCredits).toBe(0)
    })

    it('should create a Razorpay order checkout payload', async () => {
        const result = await billingService.createRazorpayOrder({
            userId,
            amountInCents: 500,
            currency: 'USD',
        })

        expect(result.keyId).toBe('rzp_test_key')
        expect(result.orderId).toBe('order_test_123')
        expect(result.amount).toBe(500)
        expect(result.currency).toBe('USD')
    })

    it('should verify Razorpay payment signature and credit the wallet', async () => {
        await billingService.createRazorpayOrder({
            userId,
            amountInCents: 500,
            currency: 'USD',
        })

        const paymentId = 'pay_test_123'
        const signature = crypto
            .createHmac('sha256', 'razorpay_test_secret')
            .update(`order_test_123|${paymentId}`)
            .digest('hex')

        const result = await billingService.verifyRazorpayPayment({
            userId,
            razorpay_order_id: 'order_test_123',
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
        })

        expect(result.success).toBe(true)
        expect(result.newBalance).toBe(600) // 100 base + 500 added

        const tx = await prisma.walletTransaction.findFirst({
            where: { providerOrderId: 'order_test_123' },
        })
        expect(tx?.status).toBe('SUCCESS')
        expect(tx?.providerPaymentId).toBe(paymentId)
    })

    it('should reject invalid verification signatures', async () => {
        await billingService.createRazorpayOrder({
            userId,
            amountInCents: 500,
            currency: 'USD',
        })

        await expect(
            billingService.verifyRazorpayPayment({
                userId,
                razorpay_order_id: 'order_test_123',
                razorpay_payment_id: 'pay_test_123',
                razorpay_signature: 'invalid',
            })
        ).rejects.toThrow('invalid razorpay signature')
    })
})
