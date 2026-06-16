import '../../env'

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'

import { prisma } from '@december/database'
import { razorpay } from '../../../src/config/razorpay'
import { billingService } from '../../../src/modules/billing/billing.service'
import { createHmacSignature } from '../../../src/modules/billing/billing.utils'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Billing User',
            email: `billing-${crypto.randomUUID()}@example.com`,
            username: `billing-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const activeRazorpaySubscription = (userId: string, overrides: Record<string, unknown> = {}) => ({
    id: 'sub_test_123',
    entity: 'subscription',
    plan_id: 'plan_test_pro',
    status: 'active',
    current_start: 1_780_000_000,
    current_end: 1_782_592_000,
    customer_id: 'cust_test_123',
    short_url: 'https://rzp.io/i/test',
    notes: {
        userId,
        plan: 'PRO',
    },
    ...overrides,
})

describe('billing.service.integration', () => {
    let userId: string

    beforeEach(async () => {
        process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
        process.env.RAZORPAY_KEY_SECRET = 'razorpay_test_secret'
        process.env.RAZORPAY_PRO_PLAN_ID = 'plan_test_pro'
        process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_test_secret'
        ;(razorpay.plans as any).fetch = async () => ({
            id: 'plan_test_pro',
            period: 'monthly',
            item: {
                amount: 199900,
                currency: 'INR',
            },
        })
        ;(razorpay.subscriptions as any).create = async (data: Record<string, unknown>) => ({
            ...activeRazorpaySubscription(userId),
            ...data,
        })
        ;(razorpay.subscriptions as any).fetch = async () => activeRazorpaySubscription(userId)
        ;(razorpay.subscriptions as any).cancel = async () =>
            activeRazorpaySubscription(userId, {
                status: 'cancelled',
                ended_at: 1_782_000_000,
            })

        await prisma.usageEvent.deleteMany()
        await prisma.subscription.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        const user = await createUser()
        userId = user.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it('should fetch configured plans with Razorpay price data', async () => {
        const plans = await billingService.getPlans()
        const proPlan = plans.find((plan) => plan.id === 'PRO')

        expect(proPlan?.razorpayPlanId).toBe('plan_test_pro')
        expect(proPlan?.priceInPaise).toBe(199900)
        expect(proPlan?.currency).toBe('INR')
    })

    it('should create a Razorpay subscription checkout payload', async () => {
        const result = await billingService.createSubscription({
            userId,
            plan: 'PRO',
            quantity: 1,
            totalCount: 12,
        })

        expect(result.keyId).toBe('rzp_test_key')
        expect(result.subscriptionId).toBe('sub_test_123')
        expect(result.razorpayPlanId).toBe('plan_test_pro')
    })

    it('should verify Razorpay payment signature and activate the subscription', async () => {
        const paymentId = 'pay_test_123'
        const signature = createHmacSignature(
            `${paymentId}|sub_test_123`,
            process.env.RAZORPAY_KEY_SECRET as string
        )

        const result = await billingService.verifySubscription({
            userId,
            razorpay_subscription_id: 'sub_test_123',
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
        })

        expect(result.verified).toBe(true)
        expect(result.user.subscriptionPlan).toBe('PRO')
        expect(result.user.subscriptionStatus).toBe('ACTIVE')

        const subscription = await prisma.subscription.findUnique({ where: { userId } })
        expect(subscription?.provider).toBe('razorpay')
        expect(subscription?.providerSubscriptionId).toBe('sub_test_123')
    })

    it('should reject invalid verification signatures', async () => {
        await expect(
            billingService.verifySubscription({
                userId,
                razorpay_subscription_id: 'sub_test_123',
                razorpay_payment_id: 'pay_test_123',
                razorpay_signature: 'invalid',
            })
        ).rejects.toThrow('invalid razorpay signature')
    })

    it('should cancel an active subscription and downgrade the user', async () => {
        await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                subscriptionPlan: 'PRO',
                subscriptionStatus: 'ACTIVE',
            },
        })
        await prisma.subscription.create({
            data: {
                userId,
                provider: 'razorpay',
                providerSubscriptionId: 'sub_test_123',
                providerCustomerId: 'cust_test_123',
                providerPlanId: 'plan_test_pro',
                status: 'ACTIVE',
                plan: 'PRO',
                currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
                currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
            },
        })

        const result = await billingService.cancelSubscription({
            userId,
            cancelAtPeriodEnd: false,
        })

        expect(result.user.subscriptionPlan).toBe('FREE')
        expect(result.user.subscriptionStatus).toBe('CANCELED')
        expect(result.subscription.status).toBe('CANCELED')
    })

    it('should process signed Razorpay subscription webhooks', async () => {
        const payload = {
            event: 'subscription.activated',
            payload: {
                subscription: {
                    entity: activeRazorpaySubscription(userId),
                },
            },
        }
        const rawBody = Buffer.from(JSON.stringify(payload))
        const signature = createHmacSignature(rawBody.toString('utf8'), 'webhook_test_secret')

        const result = await billingService.handleRazorpayWebhook({
            body: payload,
            rawBody,
            signature,
        })

        expect(result.processed).toBe(true)

        const user = await prisma.user.findUnique({ where: { id: userId } })
        expect(user?.subscriptionPlan).toBe('PRO')
        expect(user?.subscriptionStatus).toBe('ACTIVE')
    })
})
