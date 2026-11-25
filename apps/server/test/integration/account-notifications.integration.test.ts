import crypto from 'crypto'

import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { emailService } from '../../src/modules/email/email.service'
import { notificationService } from '../../src/modules/notification/notification.service'
import { sessionService } from '../../src/modules/session/session.service'
import { appCache } from '../../src/shared/cache'
import { generateVapidKeys } from '../../src/shared/web-push'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const PUSH_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/test-device'

/** a browser's push keys, as PushManager.subscribe makes them */
const makeBrowser = () => {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.generateKeys()
    const authSecret = crypto.randomBytes(16)
    return {
        ecdh,
        authSecret,
        keys: {
            p256dh: ecdh.getPublicKey().toString('base64url'),
            auth: authSecret.toString('base64url'),
        },
    }
}

/** what the browser does with a push body (RFC 8291), to check what the server sent */
const decryptPush = (body: Buffer, browser: ReturnType<typeof makeBrowser>) => {
    const hmac = (key: Buffer, data: Buffer) =>
        crypto.createHmac('sha256', key).update(data).digest()
    const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, length: number) =>
        hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, length)

    const salt = body.subarray(0, 16)
    const idLength = body[20]!
    const senderKey = body.subarray(21, 21 + idLength)
    const sealed = body.subarray(21 + idLength)

    const shared = browser.ecdh.computeSecret(senderKey)
    const info = Buffer.concat([
        Buffer.from('WebPush: info\0'),
        browser.ecdh.getPublicKey(),
        senderKey,
    ])
    const ikm = hkdf(browser.authSecret, shared, info, 32)
    const key = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
    const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)

    const decipher = crypto.createDecipheriv('aes-128-gcm', key, nonce)
    decipher.setAuthTag(sealed.subarray(sealed.length - 16))
    const plain = Buffer.concat([
        decipher.update(sealed.subarray(0, sealed.length - 16)),
        decipher.final(),
    ])
    // the last byte is the 0x02 record delimiter
    return JSON.parse(plain.subarray(0, plain.length - 1).toString('utf8'))
}

const authed = (token: string) => ({
    get: (path: string) =>
        request(app)
            .get(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object) =>
        request(app)
            .post(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body),
    delete: (path: string, body: object) =>
        request(app)
            .delete(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body),
})

// #636 part 2: level, email, push, the run events and the daily summary
describe('notification settings and delivery', () => {
    const stamp = Date.now()
    const savedSendMessage = emailService.sendMessageEmail
    const savedFetch = globalThis.fetch
    const savedVapid = {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
    }
    const emails: Array<{ to: string; subject: string; body: string }> = []
    const pushes: Array<{ url: string; headers: Record<string, string>; body: Buffer }> = []
    let pushStatus = 201
    const userIds: string[] = []

    let user: { userId: string; token: string }
    let email: string
    let sessionId: string

    const setPrefs = async (data: Record<string, unknown>) => {
        await prisma.user.update({ where: { id: user.userId }, data })
    }
    const inboxTitles = async () =>
        (
            await prisma.notification.findMany({
                where: { userId: user.userId },
                orderBy: { createdAt: 'asc' },
            })
        ).map((row) => row.title)
    const emailsTo = () => emails.filter((sent) => sent.to === email)

    beforeAll(async () => {
        const vapid = generateVapidKeys()
        process.env.VAPID_PUBLIC_KEY = vapid.publicKey
        process.env.VAPID_PRIVATE_KEY = vapid.privateKey

        emailService.sendMessageEmail = (async (data: {
            to: string
            subject: string
            body: string
        }) => {
            emails.push(data)
            return { id: `email-${emails.length}` }
        }) as any
        globalThis.fetch = (async (url: string, init: RequestInit) => {
            pushes.push({
                url: String(url),
                headers: init.headers as Record<string, string>,
                body: Buffer.from(init.body as Buffer),
            })
            return new Response(null, { status: pushStatus })
        }) as any

        email = `notify-${stamp}@example.com`
        user = await createSignedInUser({ email })
        userIds.push(user.userId)
        const session = await prisma.session.create({
            data: { userId: user.userId, title: 'Fix the login page' },
        })
        sessionId = session.id
    })

    afterAll(async () => {
        emailService.sendMessageEmail = savedSendMessage
        globalThis.fetch = savedFetch
        process.env.VAPID_PUBLIC_KEY = savedVapid.publicKey
        process.env.VAPID_PRIVATE_KEY = savedVapid.privateKey
        await prisma.usageEvent.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    beforeEach(async () => {
        emails.length = 0
        pushes.length = 0
        pushStatus = 201
        await prisma.notification.deleteMany({ where: { userId: user.userId } })
        await setPrefs({ notifyLevel: 'IMPORTANT', notifyEmail: true, notifyPush: false })
    })

    describe('settings', () => {
        it('a new user gets important events by email, no push and no summary', async () => {
            await appCache.del(appCache.key('setting', 'profile', user.userId))
            const res = await authed(user.token).get('/setting')
            expect(res.body.data).toMatchObject({
                notifyLevel: 'IMPORTANT',
                notifyEmail: true,
                notifyPush: false,
                digestEnabled: false,
                digestTime: '09:00',
                timezone: 'UTC',
                notifySecurityAlerts: true,
            })
            expect(res.body.data.notifyProjectActivity).toBeUndefined()
        })
    })

    describe('level and channels', () => {
        const event = (kind: any, extra: object = {}) =>
            notificationService.notifyEvent({
                userId: user.userId,
                kind,
                sessionId,
                sessionTitle: 'Fix the login page',
                ...extra,
            })

        it('important: needs input, failed and low credits go out, finished does not', async () => {
            await event('SESSION_FINISHED')
            await event('SESSION_NEEDS_INPUT')
            await event('SESSION_FAILED', { detail: 'tests failed' })
            await event('LOW_CREDITS', { detail: '42' })

            expect(await inboxTitles()).toEqual([
                'December needs your input',
                'A session failed',
                'Your credits are low',
            ])
            expect(emailsTo().map((sent) => sent.subject)).toEqual([
                'December needs your input: "Fix the login page"',
                'A session failed: "Fix the login page"',
                'Your December credits are low',
            ])
            expect(emailsTo()[1]?.body).toContain('tests failed')
            expect(emailsTo()[1]?.body).toContain(`/session/${sessionId}`)
            expect(emailsTo()[2]?.body).toContain('$0.42')
        })

        it('everything: finished goes out too', async () => {
            await setPrefs({ notifyLevel: 'ALL' })
            await event('SESSION_FINISHED')
            expect(await inboxTitles()).toEqual(['A session finished'])
            expect(emailsTo()).toHaveLength(1)
        })

        it('nothing: no inbox row and no email', async () => {
            await setPrefs({ notifyLevel: 'NONE' })
            const result = await event('SESSION_FAILED')
            expect(result).toEqual({ inbox: false, email: false, push: 0 })
            expect(await inboxTitles()).toEqual([])
            expect(emailsTo()).toHaveLength(0)
        })

        it('email off: the inbox only', async () => {
            await setPrefs({ notifyEmail: false })
            await event('SESSION_FAILED')
            expect(await inboxTitles()).toEqual(['A session failed'])
            expect(emailsTo()).toHaveLength(0)
        })

        it('while the user watches the session: the inbox only', async () => {
            const result = await event('SESSION_NEEDS_INPUT', { isWatching: true })
            expect(result).toEqual({ inbox: true, email: false, push: 0 })
            expect(emailsTo()).toHaveLength(0)
        })
    })

    describe('browser push', () => {
        const browser = makeBrowser()

        it('GET /notification/push/key gives the public key', async () => {
            const res = await authed(user.token).get('/notification/push/key')
            expect(res.status).toBe(200)
            expect(res.body.data.publicKey).toBe(process.env.VAPID_PUBLIC_KEY)
        })

        it('refuses a push service that is not on the list', async () => {
            const res = await authed(user.token).post('/notification/push/subscribe', {
                endpoint: 'https://internal.example.com/hook',
                keys: browser.keys,
            })
            expect(res.status).toBe(400)
            expect(await prisma.pushSubscription.count({ where: { userId: user.userId } })).toBe(0)
        })

        it('POST /notification/push/subscribe saves the browser and turns push on', async () => {
            const res = await authed(user.token).post('/notification/push/subscribe', {
                endpoint: PUSH_ENDPOINT,
                keys: browser.keys,
            })
            expect(res.status).toBe(201)
            expect(res.body.data).toEqual({ notifyPush: true })
        })

        it('sends an encrypted, signed push the browser can read', async () => {
            await setPrefs({ notifyPush: true })
            const result = await notificationService.notifyEvent({
                userId: user.userId,
                kind: 'SESSION_NEEDS_INPUT',
                sessionId,
                sessionTitle: 'Fix the login page',
            })

            expect(result.push).toBe(1)
            expect(pushes).toHaveLength(1)
            const sent = pushes[0]!
            expect(sent.url).toBe(PUSH_ENDPOINT)
            expect(sent.headers['Content-Encoding']).toBe('aes128gcm')
            expect(sent.headers.Urgency).toBe('high')
            expect(sent.headers.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/)

            const payload = decryptPush(sent.body, browser)
            expect(payload).toMatchObject({
                title: 'December needs your input',
                body: '"Fix the login page" is waiting for your answer.',
            })
            expect(payload.url).toContain(`/session/${sessionId}`)
        })

        it('removes a browser that the push service says is gone', async () => {
            await setPrefs({ notifyPush: true })
            pushStatus = 410
            await notificationService.notifyEvent({
                userId: user.userId,
                kind: 'SESSION_FAILED',
                sessionId,
            })
            expect(await prisma.pushSubscription.count({ where: { userId: user.userId } })).toBe(0)
        })

        it('DELETE /notification/push/subscribe turns push off with the last browser', async () => {
            await authed(user.token).post('/notification/push/subscribe', {
                endpoint: PUSH_ENDPOINT,
                keys: browser.keys,
            })
            const res = await authed(user.token).delete('/notification/push/subscribe', {
                endpoint: PUSH_ENDPOINT,
            })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ notifyPush: false, devices: 0 })
        })

        it('answers 503 when the server has no push keys', async () => {
            const saved = process.env.VAPID_PRIVATE_KEY
            delete process.env.VAPID_PRIVATE_KEY
            try {
                const res = await authed(user.token).post('/notification/push/subscribe', {
                    endpoint: PUSH_ENDPOINT,
                    keys: browser.keys,
                })
                expect(res.status).toBe(503)
            } finally {
                process.env.VAPID_PRIVATE_KEY = saved
            }
        })
    })

    describe('run events from the worker', () => {
        const newSession = async () =>
            (
                await prisma.session.create({
                    data: { userId: user.userId, title: 'Run events' },
                })
            ).id

        it('a failed run notifies once, and its AgentEnd is not a "finished"', async () => {
            await setPrefs({ notifyLevel: 'ALL' })
            const id = await newSession()
            await sessionService.handleRunEvent({
                sessionId: id,
                event: { type: 'AgentError', error: 'model timed out' },
            })
            // a second server node gets the same event
            await sessionService.handleRunEvent({
                sessionId: id,
                event: { type: 'AgentError', error: 'model timed out' },
            })
            await sessionService.handleRunEvent({ sessionId: id, event: { type: 'AgentEnd' } })

            expect(await inboxTitles()).toEqual(['A session failed'])
            expect(emailsTo()[0]?.body).toContain('model timed out')
        })

        it('a run that ends well is "finished", once', async () => {
            await setPrefs({ notifyLevel: 'ALL' })
            const id = await newSession()
            await sessionService.handleRunEvent({ sessionId: id, event: { type: 'AgentEnd' } })
            await sessionService.handleRunEvent({ sessionId: id, event: { type: 'AgentEnd' } })
            expect(await inboxTitles()).toEqual(['A session finished'])
        })

        it('a question notifies once, however many nodes see it', async () => {
            const id = await newSession()
            await sessionService.markQuestionAsked({ sessionId: id })
            await sessionService.markQuestionAsked({ sessionId: id })
            expect(await inboxTitles()).toEqual(['December needs your input'])
            expect(emailsTo()).toHaveLength(1)
        })

        it('low credits notifies once with the balance', async () => {
            const id = await newSession()
            await sessionService.handleRunEvent({
                sessionId: id,
                event: { type: 'CreditsLow', balanceInCents: 87 },
            })
            await sessionService.handleRunEvent({
                sessionId: id,
                event: { type: 'CreditsLow', balanceInCents: 80 },
            })
            expect(await inboxTitles()).toEqual(['Your credits are low'])
            expect(emailsTo()[0]?.body).toContain('$0.87')
        })
    })

    describe('daily summary', () => {
        // 10:00 UTC, an hour after a 09:00 summary time
        const now = new Date('2026-11-25T10:00:00Z')
        let busy: { userId: string; token: string }
        let quiet: { userId: string; token: string }

        beforeAll(async () => {
            busy = await createSignedInUser({ email: `digest-busy-${stamp}@example.com` })
            quiet = await createSignedInUser({ email: `digest-quiet-${stamp}@example.com` })
            userIds.push(busy.userId, quiet.userId)
            for (const id of [busy.userId, quiet.userId]) {
                await prisma.user.update({
                    where: { id },
                    data: { digestEnabled: true, digestTime: '09:00', timezone: 'UTC' },
                })
            }
            const session = await prisma.session.create({
                data: {
                    userId: busy.userId,
                    title: 'Busy day',
                    prOpenedAt: new Date('2026-11-25T08:00:00Z'),
                    messages: {
                        create: [
                            {
                                role: 'ASSISTANT',
                                content: 'done',
                                sequence: 1,
                                createdAt: new Date('2026-11-25T07:00:00Z'),
                            },
                        ],
                    },
                },
            })
            await prisma.usageEvent.create({
                data: {
                    userId: busy.userId,
                    sessionId: session.id,
                    model: 'test-model',
                    inputTokens: 1,
                    outputTokens: 1,
                    totalTokens: 2,
                    costInCents: 123,
                    billingSource: 'CREDITS',
                    periodStart: new Date('2026-11-01T00:00:00Z'),
                    periodEnd: new Date('2026-12-01T00:00:00Z'),
                    createdAt: new Date('2026-11-25T07:00:00Z'),
                },
            })
        })

        it('is not sent before the time the user picked', async () => {
            await notificationService.sendDailyDigests({ now: new Date('2026-11-25T08:59:00Z') })
            expect(emails.filter((sent) => sent.subject === 'Your December day')).toHaveLength(0)
        })

        it('sends what happened, and nothing to a user with a quiet day', async () => {
            await notificationService.sendDailyDigests({ now })

            const summaries = emails.filter((sent) => sent.subject === 'Your December day')
            expect(summaries.map((sent) => sent.to)).toEqual([`digest-busy-${stamp}@example.com`])
            expect(summaries[0]?.body).toContain('December worked on 1 session.')
            expect(summaries[0]?.body).toContain('1 pull request was opened.')
            expect(summaries[0]?.body).toContain('You used $1.23 of credits.')

            // both are marked, so the quiet one is not checked again today
            const quietRow = await prisma.user.findUnique({ where: { id: quiet.userId } })
            expect(quietRow?.lastDigestAt?.toISOString()).toBe(now.toISOString())
        })

        it('sends once a day', async () => {
            await notificationService.sendDailyDigests({ now: new Date('2026-11-25T18:00:00Z') })
            expect(emails.filter((sent) => sent.subject === 'Your December day')).toHaveLength(0)
        })

        it('follows the time zone of the user', async () => {
            // 09:30 in Kolkata is 04:00 UTC
            await prisma.user.update({
                where: { id: busy.userId },
                data: { timezone: 'Asia/Kolkata', digestTime: '09:30', lastDigestAt: null },
            })
            await notificationService.sendDailyDigests({ now: new Date('2026-11-26T03:59:00Z') })
            expect(emails.filter((sent) => sent.to.startsWith('digest-busy'))).toHaveLength(0)

            await notificationService.sendDailyDigests({ now: new Date('2026-11-26T04:00:00Z') })
            expect(emails.filter((sent) => sent.to.startsWith('digest-busy'))).toHaveLength(1)
        })
    })
})
