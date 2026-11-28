import crypto from 'crypto'

import { prisma } from '@december/database'
import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { razorpay } from '../../src/config/razorpay'
import { billingRepository } from '../../src/modules/billing/billing.repository'
import { notificationService } from '../../src/modules/notification/notification.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// money paths of billing: the order, verify and the webhook racing each other, the payments
// list, strict bodies and bounds. razorpay is never called: orders.create is stubbed.

const KEY_SECRET = 'payments_test_key_secret'
const WEBHOOK_SECRET = 'payments_test_webhook_secret'
const stamp = Date.now()
const userIds: string[] = []
const redeemCodeIds: string[] = []

const api = (token?: string) => {
    const withAuth = (req: request.Test) => {
        req.set('x-forwarded-for', getRandomIP())
        return token ? req.set('Authorization', `Bearer ${token}`) : req
    }
    return {
        get: (path: string) => withAuth(request(app).get(`/api/v1${path}`)),
        post: (path: string, body?: unknown) =>
            withAuth(request(app).post(`/api/v1${path}`)).send(body as object),
    }
}

const newUser = async (name: string, creditBalance = 0) => {
    const user = await createSignedInUser({
        email: `payments-${name}-${stamp}@example.com`,
        name: `Payments ${name}`,
    })
    userIds.push(user.userId)
    if (creditBalance) {
        await prisma.user.update({ where: { id: user.userId }, data: { creditBalance } })
    }
    return user
}

const balanceOf = async (userId: string) =>
    (await prisma.user.findUnique({ where: { id: userId } }))?.creditBalance

const orderSignature = (orderId: string, paymentId: string) =>
    crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex')

const sendWebhook = (payload: unknown, signature?: string) => {
    const raw = JSON.stringify(payload)
    return request(app)
        .post('/api/v1/billing/webhook/razorpay')
        .set('x-forwarded-for', getRandomIP())
        .set('Content-Type', 'application/json')
        .set(
            'x-razorpay-signature',
            signature ?? crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')
        )
        .send(raw)
}

const captured = (orderId: string, paymentId: string) => ({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: 92680 } } },
})

const failed = (orderId: string, paymentId: string) => ({
    event: 'payment.failed',
    payload: {
        payment: {
            entity: { id: paymentId, order_id: orderId, error_description: 'card declined' },
        },
    },
})

let orderCount = 0
/** a pending order of the user, as POST /wallet/order/razorpay saves it */
const pendingOrder = async (userId: string, amountInCents = 1000) => {
    orderCount += 1
    const orderId = `order_pay_${stamp}_${orderCount}`
    await prisma.walletTransaction.create({
        data: {
            userId,
            amountInCents,
            currency: 'USD',
            provider: 'RAZORPAY',
            providerOrderId: orderId,
            status: 'PENDING',
            metadata: { amountInPaise: amountInCents * 92.68, usdToInrRate: 92.68 },
        },
    })
    return orderId
}

const transactionOf = (orderId: string) =>
    prisma.walletTransaction.findFirst({ where: { providerOrderId: orderId } })

const originalEnv = {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    rate: process.env.USD_TO_INR_RATE,
}

beforeAll(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_payments'
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
})

afterAll(async () => {
    process.env.RAZORPAY_KEY_ID = originalEnv.keyId
    process.env.RAZORPAY_KEY_SECRET = originalEnv.keySecret
    process.env.RAZORPAY_WEBHOOK_SECRET = originalEnv.webhookSecret
    if (originalEnv.rate === undefined) delete process.env.USD_TO_INR_RATE
    else process.env.USD_TO_INR_RATE = originalEnv.rate
    for (const id of userIds) {
        await prisma.notification.deleteMany({ where: { userId: id } })
        await prisma.redeemCodeClaim.deleteMany({ where: { userId: id } })
        await prisma.walletTransaction.deleteMany({ where: { userId: id } })
        await prisma.creditRequest.deleteMany({ where: { userId: id } })
        await cleanupTestUser({ id })
    }
    await prisma.redeemCode.deleteMany({ where: { id: { in: redeemCodeIds } } })
})

describe('GET /billing/overview', () => {
    it('answers 401 with no sign-in', async () => {
        expect((await api().get('/billing/overview')).status).toBe(401)
    })

    it('answers only the balance, the start date and the rate', async () => {
        const user = await newUser('overview', 1234.5)
        const res = await api(user.token).get('/billing/overview')
        expect(res.status).toBe(200)
        expect(Object.keys(res.body.data).sort()).toEqual([
            'createdAt',
            'creditBalance',
            'usdToInrRate',
        ])
        expect(res.body.data.creditBalance).toBe(1234.5)
    })
})

describe('POST /billing/wallet/order/razorpay', () => {
    afterEach(() => {
        delete process.env.USD_TO_INR_RATE
    })

    it('answers 401 with no sign-in', async () => {
        const res = await api().post('/billing/wallet/order/razorpay', { amountInCents: 1000 })
        expect(res.status).toBe(401)
    })

    it('refuses another currency, an unknown field and a string amount', async () => {
        const user = await newUser('order-strict')
        const create = spyOn(razorpay.orders, 'create')
        try {
            for (const body of [
                { amountInCents: 1000, currency: 'INR' },
                { amountInCents: 1000, amountInPaise: 1 },
                { amountInCents: '1000' },
                {},
            ]) {
                const res = await api(user.token).post('/billing/wallet/order/razorpay', body)
                expect(res.status).toBe(400)
            }
            expect(create).not.toHaveBeenCalled()
        } finally {
            create.mockRestore()
        }
    })

    it('charges the paise worked out on the server and saves the usd cents to credit', async () => {
        process.env.USD_TO_INR_RATE = '90.5'
        const user = await newUser('order-amount')
        let sent: any = null
        const create = spyOn(razorpay.orders, 'create').mockImplementation((async (data: any) => {
            sent = data
            return { id: `order_amount_${stamp}`, amount: data.amount, currency: 'INR' }
        }) as any)
        try {
            const res = await api(user.token).post('/billing/wallet/order/razorpay', {
                amountInCents: 1234,
            })
            expect(res.status).toBe(201)
            expect(sent.amount).toBe(Math.round(1234 * 90.5))
            expect(sent.currency).toBe('INR')
            expect(res.body.data.usdToInrRate).toBe(90.5)
            const saved = await transactionOf(`order_amount_${stamp}`)
            expect(saved?.amountInCents).toBe(1234)
            expect(saved?.status).toBe('PENDING')
            expect((saved?.metadata as any)?.amountInPaise).toBe(Math.round(1234 * 90.5))
        } finally {
            create.mockRestore()
        }
    })

    it('falls back to the default rate when USD_TO_INR_RATE is not a number above zero', async () => {
        const user = await newUser('order-rate')
        let sent: any = null
        const create = spyOn(razorpay.orders, 'create').mockImplementation((async (data: any) => {
            sent = data
            return {
                id: `order_rate_${stamp}_${Math.random()}`,
                amount: data.amount,
                currency: 'INR',
            }
        }) as any)
        try {
            for (const rate of ['abc', '0', '-5']) {
                process.env.USD_TO_INR_RATE = rate
                const res = await api(user.token).post('/billing/wallet/order/razorpay', {
                    amountInCents: 100,
                })
                expect(res.status).toBe(201)
                expect(Number.isInteger(sent.amount)).toBe(true)
                expect(sent.amount).toBeGreaterThan(0)
            }
        } finally {
            create.mockRestore()
        }
    })
})

describe('POST /billing/wallet/verify/razorpay', () => {
    it('answers 401 with no sign-in', async () => {
        const res = await api().post('/billing/wallet/verify/razorpay', {
            razorpay_order_id: 'o',
            razorpay_payment_id: 'p',
            razorpay_signature: 's',
        })
        expect(res.status).toBe(401)
    })

    it('refuses an unknown field and ids that are too long', async () => {
        const user = await newUser('verify-strict')
        const base = { razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 's' }
        for (const body of [
            { ...base, amountInCents: 5000 },
            { ...base, razorpay_order_id: 'o'.repeat(65) },
            { ...base, razorpay_signature: 's'.repeat(257) },
        ]) {
            const res = await api(user.token).post('/billing/wallet/verify/razorpay', body)
            expect(res.status).toBe(400)
        }
    })

    it('refuses the signature of another order or another payment', async () => {
        const user = await newUser('verify-swap')
        const orderId = await pendingOrder(user.userId)
        const otherOrder = await pendingOrder(user.userId)
        // a real signature, but of another order: it must not pay this one
        const res = await api(user.token).post('/billing/wallet/verify/razorpay', {
            razorpay_order_id: orderId,
            razorpay_payment_id: 'pay_x',
            razorpay_signature: orderSignature(otherOrder, 'pay_x'),
        })
        expect(res.status).toBe(400)
        const resPayment = await api(user.token).post('/billing/wallet/verify/razorpay', {
            razorpay_order_id: orderId,
            razorpay_payment_id: 'pay_y',
            razorpay_signature: orderSignature(orderId, 'pay_x'),
        })
        expect(resPayment.status).toBe(400)
        expect((await transactionOf(orderId))?.status).toBe('PENDING')
        expect(await balanceOf(user.userId)).toBe(0)
    })

    it('credits the amount of the saved order, never a value from the client', async () => {
        const user = await newUser('verify-amount')
        const orderId = await pendingOrder(user.userId, 700)
        const res = await api(user.token).post('/billing/wallet/verify/razorpay', {
            razorpay_order_id: orderId,
            razorpay_payment_id: 'pay_amount',
            razorpay_signature: orderSignature(orderId, 'pay_amount'),
        })
        expect(res.status).toBe(200)
        expect(res.body.data.newBalance).toBe(700)
    })

    it('the same payment sent five times at once adds the credit one time', async () => {
        const user = await newUser('verify-replay')
        const orderId = await pendingOrder(user.userId, 1000)
        const body = {
            razorpay_order_id: orderId,
            razorpay_payment_id: 'pay_replay',
            razorpay_signature: orderSignature(orderId, 'pay_replay'),
        }
        const results = await Promise.all(
            Array.from({ length: 5 }, () =>
                api(user.token).post('/billing/wallet/verify/razorpay', body)
            )
        )
        expect(results.every((res) => res.status === 200)).toBe(true)
        expect(results.filter((res) => !res.body.data.alreadyProcessed)).toHaveLength(1)
        expect(await balanceOf(user.userId)).toBe(1000)
    })

    it('another user cannot verify the order, even with a real signature', async () => {
        const owner = await newUser('verify-owner')
        const other = await newUser('verify-other')
        const orderId = await pendingOrder(owner.userId)
        const res = await api(other.token).post('/billing/wallet/verify/razorpay', {
            razorpay_order_id: orderId,
            razorpay_payment_id: 'pay_other',
            razorpay_signature: orderSignature(orderId, 'pay_other'),
        })
        expect(res.status).toBe(403)
        expect(await balanceOf(other.userId)).toBe(0)
        expect(await balanceOf(owner.userId)).toBe(0)
    })
})

describe('verify and the webhook together', () => {
    it('verify and the captured webhook of one payment at the same time add the credit once', async () => {
        const user = await newUser('race')
        const orderId = await pendingOrder(user.userId, 1500)
        const [verify, webhook] = await Promise.all([
            api(user.token).post('/billing/wallet/verify/razorpay', {
                razorpay_order_id: orderId,
                razorpay_payment_id: 'pay_race',
                razorpay_signature: orderSignature(orderId, 'pay_race'),
            }),
            sendWebhook(captured(orderId, 'pay_race')),
        ])
        expect(verify.status).toBe(200)
        expect(webhook.status).toBe(200)
        expect(await balanceOf(user.userId)).toBe(1500)
        expect((await transactionOf(orderId))?.status).toBe('SUCCESS')
    })

    it('two captured webhooks at the same time add the credit once', async () => {
        const user = await newUser('race-webhooks')
        const orderId = await pendingOrder(user.userId, 800)
        const results = await Promise.all([
            sendWebhook(captured(orderId, 'pay_w')),
            sendWebhook(captured(orderId, 'pay_w')),
            sendWebhook({ event: 'order.paid', payload: { order: { entity: { id: orderId } } } }),
        ])
        expect(results.map((res) => res.status)).toEqual([200, 200, 200])
        expect(results.filter((res) => res.body.data.status === 'processed')).toHaveLength(1)
        expect(await balanceOf(user.userId)).toBe(800)
    })

    it('a late failed event does not turn a paid order back, so a later capture does not pay twice', async () => {
        const user = await newUser('late-failed')
        const orderId = await pendingOrder(user.userId, 1000)
        await api(user.token).post('/billing/wallet/verify/razorpay', {
            razorpay_order_id: orderId,
            razorpay_payment_id: 'pay_ok',
            razorpay_signature: orderSignature(orderId, 'pay_ok'),
        })

        const late = await sendWebhook(failed(orderId, 'pay_first_try'))
        expect(late.status).toBe(200)
        expect(late.body.data.status).toBe('ignored')
        const row = await transactionOf(orderId)
        expect(row?.status).toBe('SUCCESS')
        expect(row?.providerPaymentId).toBe('pay_ok')

        const capture = await sendWebhook(captured(orderId, 'pay_ok'))
        expect(capture.body.data.status).toBe('already_processed')
        expect(await balanceOf(user.userId)).toBe(1000)
    })

    it('a failed try keeps the INR amount of the order, and a later try that goes through pays once', async () => {
        const user = await newUser('retry')
        const orderId = await pendingOrder(user.userId, 1000)

        const fail = await sendWebhook(failed(orderId, 'pay_try_1'))
        expect(fail.body.data.status).toBe('failed_recorded')
        const failedRow = await transactionOf(orderId)
        expect(failedRow?.status).toBe('FAILED')
        expect((failedRow?.metadata as any)?.error).toBe('card declined')
        expect((failedRow?.metadata as any)?.amountInPaise).toBe(1000 * 92.68)

        const capture = await sendWebhook(captured(orderId, 'pay_try_2'))
        expect(capture.body.data.status).toBe('processed')
        const again = await sendWebhook(captured(orderId, 'pay_try_2'))
        expect(again.body.data.status).toBe('already_processed')
        expect(await balanceOf(user.userId)).toBe(1000)
    })
})

describe('the failed event in a race', () => {
    it('a failed event that read the row before verify paid it does not turn it back', async () => {
        const user = await newUser('race-failed')
        const orderId = await pendingOrder(user.userId, 1000)
        // the webhook read the row while it was pending...
        const stale = await transactionOf(orderId)
        // ...then verify paid it
        await api(user.token).post('/billing/wallet/verify/razorpay', {
            razorpay_order_id: orderId,
            razorpay_payment_id: 'pay_paid',
            razorpay_signature: orderSignature(orderId, 'pay_paid'),
        })
        const find = spyOn(billingRepository, 'findWalletTransactionByOrderId').mockImplementation(
            (async () => stale) as any
        )
        try {
            const res = await sendWebhook(failed(orderId, 'pay_failed'))
            expect(res.status).toBe(200)
            expect(res.body.data.status).toBe('ignored')
        } finally {
            find.mockRestore()
        }
        const row = await transactionOf(orderId)
        expect(row?.status).toBe('SUCCESS')
        expect(row?.providerPaymentId).toBe('pay_paid')
        // so a later capture of the same payment finds it paid and adds nothing
        const capture = await sendWebhook(captured(orderId, 'pay_paid'))
        expect(capture.body.data.status).toBe('already_processed')
        expect(await balanceOf(user.userId)).toBe(1000)
    })

    it('markWalletTransactionFailed changes only a pending row', async () => {
        const user = await newUser('mark-failed')
        const orderId = await pendingOrder(user.userId)
        const row = await transactionOf(orderId)
        expect(
            await billingRepository.markWalletTransactionFailed(row!.id, { error: 'declined' })
        ).toBe(true)
        expect(
            await billingRepository.markWalletTransactionFailed(row!.id, { error: 'again' })
        ).toBe(false)
        const after = await transactionOf(orderId)
        expect(after?.status).toBe('FAILED')
        expect((after?.metadata as any)?.error).toBe('declined')
    })
})

describe('POST /billing/webhook/razorpay: signature and body', () => {
    it('answers 400 with no signature, with an empty one, and with a wrong one', async () => {
        const payload = captured('order_none', 'pay_none')
        const missing = await request(app)
            .post('/api/v1/billing/webhook/razorpay')
            .set('x-forwarded-for', getRandomIP())
            .send(payload)
        expect(missing.status).toBe(400)
        expect((await sendWebhook(payload, 'a'.repeat(64))).status).toBe(400)
        expect((await sendWebhook(payload, 'short')).status).toBe(400)
    })

    it('refuses a body changed after it was signed', async () => {
        const user = await newUser('webhook-tamper')
        const orderId = await pendingOrder(user.userId)
        const signed = JSON.stringify(captured('order_other', 'pay_t'))
        const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(signed).digest('hex')
        const res = await sendWebhook(captured(orderId, 'pay_t'), signature)
        expect(res.status).toBe(400)
        expect((await transactionOf(orderId))?.status).toBe('PENDING')
    })

    it('checks the signature over the bytes sent, not over a parsed copy', async () => {
        const user = await newUser('webhook-bytes')
        const orderId = await pendingOrder(user.userId, 300)
        // the same json with other spacing: a parsed copy would match, the bytes do not
        const raw = JSON.stringify(captured(orderId, 'pay_b'), null, 2)
        const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')
        const res = await request(app)
            .post('/api/v1/billing/webhook/razorpay')
            .set('x-forwarded-for', getRandomIP())
            .set('Content-Type', 'application/json')
            .set('x-razorpay-signature', signature)
            .send(raw)
        expect(res.status).toBe(200)
        expect(res.body.data.status).toBe('processed')
        expect(await balanceOf(user.userId)).toBe(300)
    })

    it('refuses a body that is not json', async () => {
        const raw = 'event=payment.captured'
        const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')
        const res = await request(app)
            .post('/api/v1/billing/webhook/razorpay')
            .set('x-forwarded-for', getRandomIP())
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('x-razorpay-signature', signature)
            .send(raw)
        expect(res.status).toBe(400)
    })

    it('answers order_not_found for an order nobody made and ignores other events', async () => {
        const unknown = await sendWebhook(captured(`order_unknown_${stamp}`, 'pay_u'))
        expect(unknown.status).toBe(200)
        expect(unknown.body.data.status).toBe('order_not_found')
        const other = await sendWebhook({ event: 'refund.created', payload: {} })
        expect(other.body.data.status).toBe('ignored')
        const noOrder = await sendWebhook({ event: 'payment.captured', payload: {} })
        expect(noOrder.body.data.status).toBe('ignored_no_order_id')
    })
})

describe('GET /billing/transactions', () => {
    let owner: { userId: string; token: string }
    let other: { userId: string; token: string }

    beforeAll(async () => {
        owner = await newUser('list')
        other = await newUser('list-other')
        const at = (minute: number) => new Date(Date.UTC(2026, 2, 11, 10, minute))
        const row = (data: Record<string, unknown>) =>
            prisma.walletTransaction.create({
                data: { userId: owner.userId, currency: 'USD', ...data } as any,
            })
        await row({
            amountInCents: 1000,
            provider: 'RAZORPAY',
            status: 'SUCCESS',
            providerOrderId: `order_list_paid_${stamp}`,
            createdAt: at(5),
        })
        await row({
            amountInCents: 2000,
            provider: 'RAZORPAY',
            status: 'FAILED',
            providerOrderId: `order_list_failed_${stamp}`,
            createdAt: at(4),
        })
        // an opened checkout that was not paid: not in the list
        await row({
            amountInCents: 3000,
            provider: 'RAZORPAY',
            status: 'PENDING',
            providerOrderId: `order_list_pending_${stamp}`,
            createdAt: at(6),
        })
        await row({ amountInCents: 500, provider: 'GRANT', status: 'SUCCESS', createdAt: at(3) })
        await row({
            amountInCents: -200,
            provider: 'ADJUSTMENT',
            status: 'SUCCESS',
            createdAt: at(2),
        })
        await row({ amountInCents: 500, provider: 'REFERRAL', status: 'SUCCESS', createdAt: at(1) })
        const code = await prisma.redeemCode.create({
            data: {
                creditAmount: 250,
                metadata: { code: 'WELCOME' },
            },
        })
        redeemCodeIds.push(code.id)
        await prisma.redeemCodeClaim.create({
            data: { redeemCodeId: code.id, userId: owner.userId, redeemedAt: at(0) },
        })
        await prisma.walletTransaction.create({
            data: {
                userId: other.userId,
                amountInCents: 4200,
                currency: 'USD',
                provider: 'RAZORPAY',
                status: 'SUCCESS',
                providerOrderId: `order_list_other_${stamp}`,
            },
        })
    })

    it('answers 401 with no sign-in', async () => {
        expect((await api().get('/billing/transactions')).status).toBe(401)
    })

    it('lists every row but pending checkouts, newest first, with its kind and receipt', async () => {
        const res = await api(owner.token).get('/billing/transactions')
        expect(res.status).toBe(200)
        expect(res.body.data.total).toBe(6)
        expect(res.body.data.limit).toBe(10)
        expect(res.body.data.offset).toBe(0)
        expect(
            res.body.data.items.map((row: any) => [
                row.kind,
                row.status,
                row.amountInCents,
                row.hasReceipt,
                row.code,
            ])
        ).toEqual([
            ['payment', 'SUCCESS', 1000, true, null],
            ['payment', 'FAILED', 2000, false, null],
            ['grant', 'SUCCESS', 500, false, null],
            ['adjustment', 'SUCCESS', -200, false, null],
            ['referral', 'SUCCESS', 500, false, null],
            ['code', 'SUCCESS', 250, false, 'WELCOME'],
        ])
    })

    it('sends only the fields the list shows: no order ids, payment ids or metadata', async () => {
        const res = await api(owner.token).get('/billing/transactions?limit=1')
        expect(Object.keys(res.body.data.items[0]).sort()).toEqual([
            'amountInCents',
            'code',
            'createdAt',
            'hasReceipt',
            'id',
            'kind',
            'status',
        ])
    })

    it('pages with limit and offset, and the total stays the count of all rows', async () => {
        const first = await api(owner.token).get('/billing/transactions?limit=4&offset=0')
        const second = await api(owner.token).get('/billing/transactions?limit=4&offset=4')
        expect(first.body.data.items).toHaveLength(4)
        expect(second.body.data.items).toHaveLength(2)
        expect(second.body.data.total).toBe(6)
        const ids = [...first.body.data.items, ...second.body.data.items].map((row: any) => row.id)
        expect(new Set(ids).size).toBe(6)
        const past = await api(owner.token).get('/billing/transactions?limit=4&offset=40')
        expect(past.body.data.items).toEqual([])
        expect(past.body.data.total).toBe(6)
    })

    it('shows a user only their own rows', async () => {
        const res = await api(other.token).get('/billing/transactions')
        expect(res.body.data.total).toBe(1)
        expect(res.body.data.items[0].amountInCents).toBe(4200)
        const ownerIds = (await api(owner.token).get('/billing/transactions')).body.data.items.map(
            (row: any) => row.id
        )
        expect(ownerIds).not.toContain(res.body.data.items[0].id)
    })

    it('refuses limits and offsets out of bounds, and unknown query fields', async () => {
        for (const query of [
            'limit=0',
            'limit=51',
            'limit=2.5',
            'offset=-1',
            'offset=10001',
            'limit=abc',
            `userId=${owner.userId}`,
        ]) {
            const res = await api(other.token).get(`/billing/transactions?${query}`)
            expect(res.status).toBe(400)
        }
    })
})

describe('GET /billing/credits/history: bounds', () => {
    it('refuses dates outside 2020 to 2100, a start after the end and unknown fields', async () => {
        const user = await newUser('history-bounds')
        for (const query of [
            'periodStart=2019-01-01',
            'periodEnd=2100-01-02',
            'periodStart=%2B010000-01-01',
            'periodStart=2026-03-02&periodEnd=2026-03-01',
            'limit=101',
            'offset=100001',
            'userId=someone',
        ]) {
            const res = await api(user.token).get(`/billing/credits/history?${query}`)
            expect(res.status).toBe(400)
        }
    })

    it('has no "periods": the totals are the sums of the range', async () => {
        const user = await newUser('history-shape')
        const res = await api(user.token).get('/billing/credits/history')
        expect(res.status).toBe(200)
        expect('periods' in res.body.data).toBe(false)
        expect(res.body.data.totals).toEqual({ costInCents: 0, totalTokens: 0, sessions: 0 })
    })

    it('answers 401 with no sign-in', async () => {
        expect((await api().get('/billing/credits/history')).status).toBe(401)
    })
})

describe('POST /billing/credit-request: the admin notice', () => {
    it('a failed admin notice still saves the request and answers 201', async () => {
        const user = await newUser('credit-notice')
        const notify = spyOn(notificationService, 'sendNotificationToAdmins').mockImplementation(
            (async () => {
                throw new Error('inbox down')
            }) as any
        )
        try {
            const res = await api(user.token).post('/billing/credit-request', {
                buildPlan: 'a cli tool',
                heardFrom: 'a friend',
                agreeToFeedback: true,
            })
            expect(res.status).toBe(201)
            expect(res.body.data.status).toBe('PENDING')
            const again = await api(user.token).get('/billing/credit-request')
            expect(again.body.data.status).toBe('PENDING')
        } finally {
            notify.mockRestore()
        }
    })

    it('answers 401 with no sign-in and 400 for an unknown field', async () => {
        expect(
            (
                await api().post('/billing/credit-request', {
                    buildPlan: 'abc',
                    heardFrom: 'x',
                    agreeToFeedback: true,
                })
            ).status
        ).toBe(401)
        const user = await newUser('credit-strict')
        const res = await api(user.token).post('/billing/credit-request', {
            buildPlan: 'abc',
            heardFrom: 'x',
            agreeToFeedback: true,
            amountInCents: 5000,
        })
        expect(res.status).toBe(400)
    })
})

describe('GET /usage/check: bounds', () => {
    it('refuses an estimate over $10,000 and unknown fields, and takes a normal one', async () => {
        const user = await newUser('usage-check', 500)
        expect(
            (await api(user.token).get('/usage/check?estimatedCostInCents=1000001')).status
        ).toBe(400)
        expect((await api(user.token).get('/usage/check?userId=x')).status).toBe(400)
        const ok = await api(user.token).get('/usage/check?estimatedCostInCents=400')
        expect(ok.status).toBe(200)
        expect(ok.body.data.enoughCredits).toBe(true)
        const short = await api(user.token).get('/usage/check?estimatedCostInCents=600')
        expect(short.body.data.enoughCredits).toBe(false)
    })

    it('answers 401 with no sign-in', async () => {
        expect((await api().get('/usage/check')).status).toBe(401)
        expect((await api().get('/usage')).status).toBe(401)
    })
})
