import crypto from 'crypto'

import { prisma } from '@december/database'
import axios from 'axios'
import bcrypt from 'bcrypt'
import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { OAuth2Client } from 'google-auth-library'
import request from 'supertest'

import app from '../../src/app'
import { razorpay } from '../../src/config/razorpay'
import { env } from '../../src/env'
import { emailService } from '../../src/modules/email/email.service'
import {
    asAdmin,
    authCookieToken,
    cleanupTestUser,
    createSignedInUser,
    getRandomIP,
} from '../helpers'

// #638 section 3, referrals. the tests read and write through the http routes. razorpay,
// google and github are replaced at their edge: no call leaves the test.

const stamp = Date.now()
const userIds: string[] = []
const emails: string[] = []

const email = (name: string) => {
    const address = `referral-${name}-${stamp}@example.com`
    emails.push(address)
    return address
}

const get = (token: string, path: string) =>
    request(app)
        .get(`/api/v1${path}`)
        .set('x-forwarded-for', getRandomIP())
        .set('Authorization', `Bearer ${token}`)

/** an account that exists, with its sign-in */
const newUser = async (name: string) => {
    const user = await createSignedInUser({ email: email(name), name: `Referral ${name}` })
    userIds.push(user.userId)
    return user
}

/** the referral code of a user, read the way the billing page reads it */
const codeOf = async (token: string) => {
    const res = await get(token, '/billing/referral')
    return res.body.data.code as string
}

const post = (path: string, body: Record<string, unknown>) =>
    request(app).post(`/api/v1${path}`).set('x-forwarded-for', getRandomIP()).send(body)

const OTP = '864209'

/** a sign-up with the email code: start, then verify with a known code */
const signUpWithEmail = async (address: string, referralCode?: unknown) => {
    const started = await post('/auth/email/start', { email: address })
    expect(started.status).toBe(200)
    await prisma.user.update({
        where: { email: address },
        data: { otpHash: await bcrypt.hash(OTP, env.BCRYPT_SALT_ROUNDS) },
    })
    return post('/auth/email/verify', {
        email: address,
        otp: OTP,
        ...(referralCode === undefined ? {} : { referralCode }),
    })
}

/** google answers for one sign-in with this profile */
const stubGoogle = (profile: { email: string; sub: string }) =>
    spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation((async () => ({
        getPayload: () => ({ ...profile, name: 'Referral Google', email_verified: true }),
    })) as any)

/** github answers for one sign-in with this profile */
const stubGithub = (profile: { email: string; id: number }) => {
    const postSpy = spyOn(axios, 'post').mockImplementation((async () => ({
        data: { access_token: 'gho_test' },
    })) as any)
    const getSpy = spyOn(axios, 'get').mockImplementation((async (url: string) =>
        url.endsWith('/user/emails')
            ? { data: [{ email: profile.email, primary: true, verified: true }] }
            : {
                  data: {
                      id: profile.id,
                      login: `referral-${profile.id}`,
                      name: 'Referral Github',
                  },
              }) as any)
    return { mockRestore: () => (postSpy.mockRestore(), getSpy.mockRestore()) }
}

const referralOf = async (address: string) => {
    const user = await prisma.user.findUnique({
        where: { email: address },
        include: { referredBy: true },
    })
    return user?.referredBy ?? null
}

const balanceOf = async (userId: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).creditBalance

// the same test keys as the other billing tests, so the files can run in one process
const RAZORPAY_SECRET = 'test_razorpay_secret_key_123'
const WEBHOOK_SECRET = 'test_webhook_secret_key'
let orderCount = 0

const authedPost = (token: string, path: string, body: Record<string, unknown> = {}) =>
    post(path, body).set('Authorization', `Bearer ${token}`)

/** an order for a top-up that razorpay has not been paid for yet */
const createOrder = async (token: string, amountInCents = 1000) => {
    const orderId = `order_referral_${stamp}_${++orderCount}`
    const spy = spyOn(razorpay.orders, 'create').mockImplementation((async () => ({
        id: orderId,
        amount: 92680,
        currency: 'INR',
    })) as any)
    const res = await authedPost(token, '/billing/wallet/order/razorpay', { amountInCents })
    spy.mockRestore()
    expect(res.status).toBe(201)
    return { orderId, paymentId: `pay_referral_${stamp}_${orderCount}` }
}

/** the browser tells the server that the payment went through */
const verifyPayment = (token: string, order: { orderId: string; paymentId: string }) =>
    authedPost(token, '/billing/wallet/verify/razorpay', {
        razorpay_order_id: order.orderId,
        razorpay_payment_id: order.paymentId,
        razorpay_signature: crypto
            .createHmac('sha256', RAZORPAY_SECRET)
            .update(`${order.orderId}|${order.paymentId}`)
            .digest('hex'),
    })

/** razorpay tells the server that the payment went through */
const sendWebhook = (
    order: { orderId: string; paymentId: string },
    event: 'payment.captured' | 'order.paid' = 'payment.captured'
) => {
    const payload = {
        event,
        payload: {
            payment: { entity: { id: order.paymentId, order_id: order.orderId, amount: 92680 } },
        },
    }
    return post('/billing/webhook/razorpay', payload).set(
        'x-razorpay-signature',
        crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex')
    )
}

/** one paid top-up from start to end */
const topUp = async (token: string, amountInCents = 1000) => {
    const res = await verifyPayment(token, await createOrder(token, amountInCents))
    expect(res.status).toBe(200)
    return res
}

/** an inviter with a code, and a new account that signed up with it */
const newReferral = async (name: string, inviter?: { userId: string; token: string }) => {
    const from = inviter ?? (await newUser(`${name}-inviter`))
    const address = email(`${name}-invitee`)
    const signUp = await signUpWithEmail(address, await codeOf(from.token))
    expect(signUp.status).toBe(200)
    const invitee = await prisma.user.findUniqueOrThrow({ where: { email: address } })
    return {
        inviter: from,
        invitee: { userId: invitee.id, token: authCookieToken(signUp) as string },
    }
}

const statusOf = async (inviteeId: string) =>
    (await prisma.referral.findUniqueOrThrow({ where: { inviteeId } })).status

const referralRows = (userId: string) =>
    prisma.walletTransaction.findMany({ where: { userId, provider: 'REFERRAL' } })

afterAll(async () => {
    const users = await prisma.user.findMany({
        where: { OR: [{ id: { in: userIds } }, { email: { in: emails } }] },
        select: { id: true },
    })
    for (const { id } of users) {
        await prisma.notification.deleteMany({ where: { userId: id } })
        await cleanupTestUser({ id })
    }
})

describe('GET /billing/referral', () => {
    it('needs a sign-in', async () => {
        const res = await request(app).get('/api/v1/billing/referral')
        expect(res.status).toBe(401)
    })

    it('returns the link, the amount and the counts of a user with no referrals', async () => {
        const user = await newUser('link')

        const res = await get(user.token, '/billing/referral')

        expect(res.status).toBe(200)
        const { code, ...rest } = res.body.data
        // short and random: not made from the name of the user
        expect(code).toMatch(/^[a-z0-9]{8}$/)
        expect(code).not.toContain('referral')
        expect(rest).toEqual({
            link: `http://localhost:3000/r/${code}`,
            amountInCents: 500,
            minTopUpInCents: 1000,
            invited: 0,
            credited: 0,
            maxCredited: 20,
        })
    })

    it('keeps the same link for a user, also when the first reads come together', async () => {
        const user = await newUser('stable')

        const [first, second] = await Promise.all([
            get(user.token, '/billing/referral'),
            get(user.token, '/billing/referral'),
        ])
        const third = await get(user.token, '/billing/referral')

        expect(first.status).toBe(200)
        expect(second.body.data.code).toBe(first.body.data.code)
        expect(third.body.data.link).toBe(first.body.data.link)
    })

    it('gives each user their own code', async () => {
        const one = await newUser('own-1')
        const two = await newUser('own-2')

        const first = await get(one.token, '/billing/referral')
        const second = await get(two.token, '/billing/referral')

        expect(first.body.data.code).not.toBe(second.body.data.code)
    })
})

describe('sign-up with a referral code', () => {
    let stub: { mockRestore: () => void } | undefined

    afterEach(() => {
        stub?.mockRestore()
        stub = undefined
    })

    it('email code: a new account gets a pending referral and nobody is paid', async () => {
        const inviter = await newUser('email-inviter')
        const code = await codeOf(inviter.token)
        const address = email('email-invitee')

        const res = await signUpWithEmail(address, code)

        expect(res.status).toBe(200)
        expect(res.body.data.isNewUser).toBe(true)
        const referral = await referralOf(address)
        expect(referral?.inviterId).toBe(inviter.userId)
        expect(referral?.status).toBe('PENDING')
        expect(referral?.creditedAt).toBeNull()
        // nothing is paid at sign-up
        expect(await balanceOf(inviter.userId)).toBe(0)
        expect(await balanceOf(referral!.inviteeId)).toBe(0)
        expect(
            await prisma.walletTransaction.count({
                where: { userId: { in: [inviter.userId, referral!.inviteeId] } },
            })
        ).toBe(0)

        const counts = await get(inviter.token, '/billing/referral')
        expect(counts.body.data.invited).toBe(1)
        expect(counts.body.data.credited).toBe(0)
    })

    it('email code: the code works in capital letters', async () => {
        const inviter = await newUser('caps-inviter')
        const code = await codeOf(inviter.token)
        const address = email('caps-invitee')

        await signUpWithEmail(address, ` ${code.toUpperCase()} `)

        expect((await referralOf(address))?.inviterId).toBe(inviter.userId)
    })

    it('google: a new account gets a pending referral', async () => {
        const inviter = await newUser('google-inviter')
        const code = await codeOf(inviter.token)
        const address = email('google-invitee')
        stub = stubGoogle({ email: address, sub: `google-${stamp}-1` })

        const res = await post('/auth/google', { credential: 'id-token', referralCode: code })

        expect(res.status).toBe(200)
        const referral = await referralOf(address)
        expect(referral?.inviterId).toBe(inviter.userId)
        expect(referral?.status).toBe('PENDING')
    })

    it('github: a new account gets a pending referral', async () => {
        const inviter = await newUser('github-inviter')
        const code = await codeOf(inviter.token)
        const address = email('github-invitee')
        stub = stubGithub({ email: address, id: stamp })

        const res = await post('/auth/github', { code: 'oauth-code', referralCode: code })

        expect(res.status).toBe(200)
        expect(res.body.data.isNewUser).toBe(true)
        const referral = await referralOf(address)
        expect(referral?.inviterId).toBe(inviter.userId)
        expect(referral?.status).toBe('PENDING')
    })

    it('an account that exists cannot attach a code with a later sign-in', async () => {
        const inviter = await newUser('late-inviter')
        const code = await codeOf(inviter.token)

        // email code: the account signed up with no code, then signs in with one
        const emailAddress = email('late-email')
        await signUpWithEmail(emailAddress)
        await prisma.user.update({ where: { email: emailAddress }, data: { otpExpiresAt: null } })
        const again = await signUpWithEmail(emailAddress, code)
        expect(again.status).toBe(200)
        expect(again.body.data.isNewUser).toBe(false)
        expect(await referralOf(emailAddress)).toBeNull()

        // google and github: the account is there already
        const googleUser = await newUser('late-google')
        const googleAddress = `referral-late-google-${stamp}@example.com`
        stub = stubGoogle({ email: googleAddress, sub: `google-${stamp}-2` })
        const google = await post('/auth/google', { credential: 'id-token', referralCode: code })
        expect(google.status).toBe(200)
        stub.mockRestore()

        const githubAddress = `referral-late-github-${stamp}@example.com`
        await newUser('late-github')
        stub = stubGithub({ email: githubAddress, id: stamp + 1 })
        const github = await post('/auth/github', { code: 'oauth-code', referralCode: code })
        expect(github.status).toBe(200)
        expect(github.body.data.isNewUser).toBe(false)

        expect(await prisma.referral.count({ where: { inviterId: inviter.userId } })).toBe(0)
        expect(await prisma.referral.count({ where: { inviteeId: googleUser.userId } })).toBe(0)
    })

    it('refuses a self referral: the inviter email written another way', async () => {
        const inviterAddress = `referralself${stamp}@gmail.com`
        emails.push(inviterAddress)
        const inviter = await createSignedInUser({ email: inviterAddress, name: 'Referral Self' })
        const code = await codeOf(inviter.token)
        // gmail reads dots and a +tag as the same mailbox
        const alias = `referral.self${stamp}+two@gmail.com`
        emails.push(alias)

        const res = await signUpWithEmail(alias, code)

        expect(res.status).toBe(200)
        expect(res.body.data.isNewUser).toBe(true)
        expect(await referralOf(alias)).toBeNull()
        expect(await prisma.referral.count({ where: { inviterId: inviter.userId } })).toBe(0)
    })

    // review C1: a +tag is the same mailbox on every mail host, dots only on gmail
    it('refuses a self referral with a +tag on any mail host', async () => {
        const inviterAddress = `referral-plus-${stamp}@example.com`
        emails.push(inviterAddress)
        const inviter = await createSignedInUser({ email: inviterAddress, name: 'Referral Plus' })
        const code = await codeOf(inviter.token)
        const alias = `referral-plus-${stamp}+two@example.com`
        emails.push(alias)

        const res = await signUpWithEmail(alias, code)

        expect(res.status).toBe(200)
        expect(await referralOf(alias)).toBeNull()

        // dots are another mailbox outside gmail: that is another person
        const dotted = `referral.plus-${stamp}@example.com`
        emails.push(dotted)
        await signUpWithEmail(dotted, code)
        expect((await referralOf(dotted))?.inviterId).toBe(inviter.userId)
    })

    // review C8: the email flow was started (a row with no verified email), then the
    // person finished the sign-up with google or github. that is a new account
    it('google and github: a sign-up that started with the email code keeps the referral', async () => {
        const inviter = await newUser('started-inviter')
        const code = await codeOf(inviter.token)

        const googleAddress = email('started-google')
        expect((await post('/auth/email/start', { email: googleAddress })).status).toBe(200)
        stub = stubGoogle({ email: googleAddress, sub: `google-${stamp}-started` })
        const google = await post('/auth/google', { credential: 'id-token', referralCode: code })
        expect(google.status).toBe(200)
        stub.mockRestore()
        expect((await referralOf(googleAddress))?.inviterId).toBe(inviter.userId)

        const githubAddress = email('started-github')
        expect((await post('/auth/email/start', { email: githubAddress })).status).toBe(200)
        stub = stubGithub({ email: githubAddress, id: stamp + 7 })
        const github = await post('/auth/github', { code: 'oauth-code', referralCode: code })
        expect(github.status).toBe(200)
        expect(github.body.data.isNewUser).toBe(true)
        expect((await referralOf(githubAddress))?.inviterId).toBe(inviter.userId)
    })

    it('an unknown or broken code does not break the sign-up', async () => {
        const unknown = email('unknown-code')
        const res = await signUpWithEmail(unknown, 'zzzz9999')
        expect(res.status).toBe(200)
        expect(res.body.data.isNewUser).toBe(true)
        expect(await referralOf(unknown)).toBeNull()

        const broken = email('broken-code')
        const second = await signUpWithEmail(broken, { not: 'a code' })
        expect(second.status).toBe(200)
        expect(await referralOf(broken)).toBeNull()

        const long = email('long-code')
        const third = await signUpWithEmail(long, 'x'.repeat(5000))
        expect(third.status).toBe(200)
        expect(await referralOf(long)).toBeNull()

        const githubAddress = email('unknown-github')
        stub = stubGithub({ email: githubAddress, id: stamp + 2 })
        const fourth = await post('/auth/github', { code: 'oauth-code', referralCode: 12345 })
        expect(fourth.status).toBe(200)
        expect(await referralOf(githubAddress)).toBeNull()
    })
})

describe('referral payout', () => {
    const savedKeyId = process.env.RAZORPAY_KEY_ID
    const savedKeySecret = process.env.RAZORPAY_KEY_SECRET
    const savedWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

    beforeAll(() => {
        process.env.RAZORPAY_KEY_ID = 'rzp_test_key_123'
        process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET
        process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
    })

    afterAll(() => {
        process.env.RAZORPAY_KEY_ID = savedKeyId
        process.env.RAZORPAY_KEY_SECRET = savedKeySecret
        process.env.RAZORPAY_WEBHOOK_SECRET = savedWebhookSecret
    })

    it('the first paid top-up pays both once, with verify and the webhook for one payment', async () => {
        const { inviter, invitee } = await newReferral('first')
        const order = await createOrder(invitee.token, 1000)

        const results = await Promise.all([
            verifyPayment(invitee.token, order),
            sendWebhook(order, 'payment.captured'),
            sendWebhook(order, 'order.paid'),
        ])
        const late = await sendWebhook(order, 'payment.captured')

        expect(results.map((res) => res.status)).toEqual([200, 200, 200])
        expect(late.status).toBe(200)
        // the top-up of $10 and one credit of $5 for the new account, one credit for the inviter
        expect(await balanceOf(invitee.userId)).toBe(1500)
        expect(await balanceOf(inviter.userId)).toBe(500)
        const referral = await prisma.referral.findUniqueOrThrow({
            where: { inviteeId: invitee.userId },
        })
        expect(referral.status).toBe('CREDITED')
        expect(referral.creditedAt).toBeInstanceOf(Date)
        for (const userId of [inviter.userId, invitee.userId]) {
            const rows = await referralRows(userId)
            expect(rows).toHaveLength(1)
            expect(rows[0]).toMatchObject({
                amountInCents: 500,
                currency: 'USD',
                status: 'SUCCESS',
            })
        }

        const counts = await get(inviter.token, '/billing/referral')
        expect(counts.body.data.invited).toBe(1)
        expect(counts.body.data.credited).toBe(1)
    })

    it('the webhook alone pays the referral', async () => {
        const { inviter, invitee } = await newReferral('webhook')

        const res = await sendWebhook(await createOrder(invitee.token, 2000))

        expect(res.status).toBe(200)
        expect(res.body.data.status).toBe('processed')
        expect(await balanceOf(invitee.userId)).toBe(2500)
        expect(await balanceOf(inviter.userId)).toBe(500)
        expect(await statusOf(invitee.userId)).toBe('CREDITED')
    })

    // review C1: a second address and a $1 top-up must not pay $5 to both
    it('a first top-up under $10 pays nothing and leaves the referral pending', async () => {
        const { inviter, invitee } = await newReferral('small')

        await topUp(invitee.token, 100)
        await topUp(invitee.token, 999)

        expect(await balanceOf(invitee.userId)).toBe(1099)
        expect(await balanceOf(inviter.userId)).toBe(0)
        expect(await statusOf(invitee.userId)).toBe('PENDING')
        expect(await referralRows(inviter.userId)).toEqual([])
    })

    it('a later top-up of $10 or more pays the pending referral', async () => {
        const { inviter, invitee } = await newReferral('later')
        await topUp(invitee.token, 500)
        expect(await statusOf(invitee.userId)).toBe('PENDING')

        await topUp(invitee.token, 1000)

        expect(await balanceOf(invitee.userId)).toBe(2000)
        expect(await balanceOf(inviter.userId)).toBe(500)
        expect(await statusOf(invitee.userId)).toBe('CREDITED')
    })

    it('the webhook of a small top-up pays nothing', async () => {
        const { inviter, invitee } = await newReferral('small-webhook')

        const res = await sendWebhook(await createOrder(invitee.token, 500))

        expect(res.body.data.status).toBe('processed')
        expect(await balanceOf(invitee.userId)).toBe(500)
        expect(await balanceOf(inviter.userId)).toBe(0)
        expect(await statusOf(invitee.userId)).toBe('PENDING')
    })

    it('a second top-up pays nothing', async () => {
        const { inviter, invitee } = await newReferral('second')
        await topUp(invitee.token, 1000)

        await topUp(invitee.token, 1000)

        expect(await balanceOf(invitee.userId)).toBe(2500)
        expect(await balanceOf(inviter.userId)).toBe(500)
        expect(await referralRows(invitee.userId)).toHaveLength(1)
        expect(await referralRows(inviter.userId)).toHaveLength(1)
    })

    it('two top-ups that land together pay the referral once', async () => {
        const { inviter, invitee } = await newReferral('together')
        const first = await createOrder(invitee.token, 1000)
        const second = await createOrder(invitee.token, 1000)

        const results = await Promise.all([
            verifyPayment(invitee.token, first),
            verifyPayment(invitee.token, second),
            sendWebhook(first),
            sendWebhook(second),
        ])

        expect(results.map((res) => res.status)).toEqual([200, 200, 200, 200])
        expect(await balanceOf(invitee.userId)).toBe(2500)
        expect(await balanceOf(inviter.userId)).toBe(500)
        expect(await referralRows(invitee.userId)).toHaveLength(1)
        expect(await referralRows(inviter.userId)).toHaveLength(1)
    })

    it('a top-up of the inviter, or of an account with no referral, pays nothing', async () => {
        const { inviter, invitee } = await newReferral('inviter-pays')

        await topUp(inviter.token, 1000)

        expect(await balanceOf(inviter.userId)).toBe(1000)
        expect(await balanceOf(invitee.userId)).toBe(0)
        expect(await statusOf(invitee.userId)).toBe('PENDING')
    })

    it('a payment that failed pays nothing', async () => {
        const { inviter, invitee } = await newReferral('failed')
        const order = await createOrder(invitee.token, 1000)
        const payload = {
            event: 'payment.failed',
            payload: { payment: { entity: { id: order.paymentId, order_id: order.orderId } } },
        }

        const res = await post('/billing/webhook/razorpay', payload).set(
            'x-razorpay-signature',
            crypto
                .createHmac('sha256', WEBHOOK_SECRET)
                .update(JSON.stringify(payload))
                .digest('hex')
        )

        expect(res.status).toBe(200)
        expect(res.body.data.status).toBe('failed_recorded')
        expect(await balanceOf(inviter.userId)).toBe(0)
        expect(await balanceOf(invitee.userId)).toBe(0)
        expect(await statusOf(invitee.userId)).toBe('PENDING')
    })

    it('free credits and a credit change by an admin pay nothing', async () => {
        const { inviter, invitee } = await newReferral('free')
        const admin = await newUser('admin')
        const adminAddress = `referral-admin-${stamp}@example.com`
        const savedAdminEmails = process.env.ADMIN_EMAILS
        const savedSendMessage = emailService.sendMessageEmail
        process.env.ADMIN_EMAILS = adminAddress
        emailService.sendMessageEmail = (async () => ({ id: 'email-referral' })) as any
        try {
            // free credits: the account asks, an admin approves
            const asked = await authedPost(invitee.token, '/billing/credit-request', {
                buildPlan: 'a todo app',
                heardFrom: 'a friend',
                agreeToFeedback: true,
            })
            expect(asked.status).toBe(201)
            const creditRequest = await prisma.creditRequest.findFirstOrThrow({
                where: { userId: invitee.userId },
            })
            const adminApi = await asAdmin(admin)
            const approved = await adminApi.post(
                `/admin/credit-requests/${creditRequest.id}/approve`
            )
            expect(approved.status).toBe(200)

            // a credit change
            const changed = await adminApi.post(`/admin/users/${invitee.userId}/credits`, {
                amountInCents: 300,
            })
            expect(changed.status).toBe(200)
        } finally {
            process.env.ADMIN_EMAILS = savedAdminEmails
            emailService.sendMessageEmail = savedSendMessage
            await prisma.adminAuditLog.deleteMany({ where: { adminUserId: admin.userId } })
            await prisma.creditRequest.deleteMany({ where: { userId: invitee.userId } })
        }

        // $5 of free credits and $3 from the admin
        expect(await balanceOf(invitee.userId)).toBe(800)
        expect(await balanceOf(inviter.userId)).toBe(0)
        expect(await statusOf(invitee.userId)).toBe('PENDING')
        expect(await referralRows(invitee.userId)).toHaveLength(0)
    })

    it('at the cap of 20 paid referrals the next one is skipped and nobody is paid', async () => {
        const inviter = await newUser('cap-inviter')
        // 19 paid referrals from before
        const earlier = Array.from({ length: 19 }, (_, index) => ({
            id: crypto.randomUUID(),
            name: 'Referral Cap',
            email: email(`cap-earlier-${index}`),
            emailVerified: true,
        }))
        await prisma.user.createMany({ data: earlier })
        await prisma.referral.createMany({
            data: earlier.map((user) => ({
                inviterId: inviter.userId,
                inviteeId: user.id,
                status: 'CREDITED' as const,
                creditedAt: new Date(),
            })),
        })
        const { invitee: twentieth } = await newReferral('cap-20', inviter)
        const { invitee: twentyFirst } = await newReferral('cap-21', inviter)
        const { invitee: twentySecond } = await newReferral('cap-22', inviter)

        // number 20 is the last one under the cap
        await topUp(twentieth.token, 1000)
        expect(await statusOf(twentieth.userId)).toBe('CREDITED')
        expect(await balanceOf(inviter.userId)).toBe(500)

        // 21 and 22 pay at the same time: both are over the cap
        const firstOrder = await createOrder(twentyFirst.token, 1000)
        const secondOrder = await createOrder(twentySecond.token, 1000)
        await Promise.all([
            verifyPayment(twentyFirst.token, firstOrder),
            verifyPayment(twentySecond.token, secondOrder),
        ])

        expect(await statusOf(twentyFirst.userId)).toBe('SKIPPED')
        expect(await statusOf(twentySecond.userId)).toBe('SKIPPED')
        // the new accounts keep their own top-up of $10, with no credit on it
        expect(await balanceOf(twentyFirst.userId)).toBe(1000)
        expect(await balanceOf(twentySecond.userId)).toBe(1000)
        expect(await balanceOf(inviter.userId)).toBe(500)
        expect(await referralRows(twentyFirst.userId)).toHaveLength(0)
        expect(await referralRows(inviter.userId)).toHaveLength(1)

        // a skipped referral stays skipped
        await topUp(twentyFirst.token, 1000)
        expect(await balanceOf(twentyFirst.userId)).toBe(2000)
        expect(await balanceOf(inviter.userId)).toBe(500)

        const counts = await get(inviter.token, '/billing/referral')
        expect(counts.body.data).toMatchObject({ invited: 22, credited: 20, maxCredited: 20 })
    })

    it('two new accounts that pay together cannot both take the last place under the cap', async () => {
        const inviter = await newUser('race-inviter')
        const earlier = Array.from({ length: 19 }, (_, index) => ({
            id: crypto.randomUUID(),
            name: 'Referral Race',
            email: email(`race-earlier-${index}`),
            emailVerified: true,
        }))
        await prisma.user.createMany({ data: earlier })
        await prisma.referral.createMany({
            data: earlier.map((user) => ({
                inviterId: inviter.userId,
                inviteeId: user.id,
                status: 'CREDITED' as const,
                creditedAt: new Date(),
            })),
        })
        const { invitee: one } = await newReferral('race-1', inviter)
        const { invitee: two } = await newReferral('race-2', inviter)
        const firstOrder = await createOrder(one.token, 1000)
        const secondOrder = await createOrder(two.token, 1000)

        await Promise.all([
            verifyPayment(one.token, firstOrder),
            verifyPayment(two.token, secondOrder),
        ])

        const statuses = [await statusOf(one.userId), await statusOf(two.userId)].sort()
        expect(statuses).toEqual(['CREDITED', 'SKIPPED'])
        expect(await balanceOf(inviter.userId)).toBe(500)
        expect((await balanceOf(one.userId)) + (await balanceOf(two.userId))).toBe(2500)
    })

    it('the billing history has both credits with the referral type, and they have no receipt', async () => {
        const { inviter, invitee } = await newReferral('history')
        await topUp(invitee.token, 1000)

        const inviterHistory = await get(inviter.token, '/billing/transactions')
        const inviteeHistory = await get(invitee.token, '/billing/transactions')

        expect(inviterHistory.status).toBe(200)
        expect(
            inviterHistory.body.data.items.map((row: any) => ({
                kind: row.kind,
                status: row.status,
                amountInCents: row.amountInCents,
                hasReceipt: row.hasReceipt,
            }))
        ).toEqual([{ kind: 'referral', status: 'SUCCESS', amountInCents: 500, hasReceipt: false }])
        expect((await get(inviter.token, '/billing/overview')).body.data.creditBalance).toBe(500)

        const inviteeRows = inviteeHistory.body.data.items.map((row: any) => ({
            kind: row.kind,
            amountInCents: row.amountInCents,
        }))
        expect(inviteeRows).toHaveLength(2)
        expect(inviteeRows).toContainEqual({ kind: 'referral', amountInCents: 500 })
        expect(inviteeRows).toContainEqual({ kind: 'payment', amountInCents: 1000 })
        expect((await get(invitee.token, '/billing/overview')).body.data.creditBalance).toBe(1500)

        // a referral credit is not a payment: no receipt. the payment has one
        for (const [history, token] of [
            [inviterHistory, inviter.token],
            [inviteeHistory, invitee.token],
        ] as const) {
            const row = history.body.data.items.find((tx: any) => tx.kind === 'referral')
            const receipt = await get(token, `/billing/transactions/${row.id}/receipt`)
            expect(receipt.status).toBe(404)
        }
        const paid = inviteeHistory.body.data.items.find((tx: any) => tx.kind === 'payment')
        expect(paid.hasReceipt).toBe(true)
        const receipt = await get(invitee.token, `/billing/transactions/${paid.id}/receipt`)
        expect(receipt.status).toBe(200)
        expect(receipt.headers['content-type']).toContain('application/pdf')
    })
})
