import crypto from 'crypto'

import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { generateAccessToken } from '../../src/modules/auth/auth.utils'
import { emailService } from '../../src/modules/email/email.service'
import { notificationService } from '../../src/modules/notification/notification.service'
import { generateVapidKeys } from '../../src/shared/web-push'
import { cleanupTestUser, getRandomIP } from '../helpers'

const DAY_MS = 24 * 60 * 60 * 1000

const endpointOf = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`

/** the push keys a browser sends with its subscription */
const browserKeys = () => {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.generateKeys()
    return {
        p256dh: ecdh.getPublicKey().toString('base64url'),
        auth: crypto.randomBytes(16).toString('base64url'),
    }
}

const authed = (token: string) => {
    const call = (method: 'get' | 'post' | 'delete', path: string) =>
        request(app)
            [method](`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
    return {
        get: (path: string) => call('get', path),
        post: (path: string, body: object = {}) => call('post', path).send(body),
        delete: (path: string) => call('delete', path),
    }
}

// #636: a browser that is signed out gets no more push, and the next user on it starts off
describe('browser push and sign out', () => {
    const stamp = Date.now()
    const savedSendMessage = emailService.sendMessageEmail
    const savedFetch = globalThis.fetch
    const savedVapid = {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
    }
    const pushedTo: string[] = []
    const userIds: string[] = []

    let userId: string
    let otherUserId: string
    let other: { id: string; token: string }

    /** one more signed-in browser of a user */
    const signIn = async (ownerId: string, expiresAt?: Date) => {
        const session = await prisma.authSession.create({
            data: {
                userId: ownerId,
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0 Safari/537.36',
                refreshTokenHash: `test-hash-${crypto.randomUUID()}`,
                expiresAt: expiresAt ?? new Date(Date.now() + 7 * DAY_MS),
            },
        })
        return {
            id: session.id,
            token: generateAccessToken({ userId: ownerId, sessionId: session.id }),
        }
    }

    /** signs a browser in and turns push on in it */
    const browserWithPush = async (name: string) => {
        const browser = await signIn(userId)
        const res = await authed(browser.token).post('/notification/push/subscribe', {
            endpoint: endpointOf(`${name}-${stamp}`),
            keys: browserKeys(),
        })
        expect(res.status).toBe(201)
        return { ...browser, endpoint: endpointOf(`${name}-${stamp}`) }
    }

    const endpointsLeft = async () =>
        (
            await prisma.pushSubscription.findMany({
                where: { userId },
                orderBy: { endpoint: 'asc' },
            })
        ).map((row) => row.endpoint)

    /** the browsers a failed-session event is pushed to */
    const pushFailedSession = async () => {
        pushedTo.length = 0
        await notificationService.notifyEvent({ userId, kind: 'SESSION_FAILED' })
        return [...pushedTo].sort()
    }

    beforeAll(async () => {
        const vapid = generateVapidKeys()
        process.env.VAPID_PUBLIC_KEY = vapid.publicKey
        process.env.VAPID_PRIVATE_KEY = vapid.privateKey

        emailService.sendMessageEmail = (async () => ({ id: 'email' })) as any
        globalThis.fetch = (async (url: string) => {
            pushedTo.push(String(url))
            return new Response(null, { status: 201 })
        }) as any

        const user = await prisma.user.create({
            data: { email: `push-signout-${stamp}@example.com`, name: 'Push', emailVerified: true },
        })
        userId = user.id
        const otherUser = await prisma.user.create({
            data: {
                email: `push-signout-next-${stamp}@example.com`,
                name: 'Next',
                emailVerified: true,
            },
        })
        otherUserId = otherUser.id
        userIds.push(userId, otherUserId)
        other = await signIn(otherUserId)
    })

    afterAll(async () => {
        emailService.sendMessageEmail = savedSendMessage
        globalThis.fetch = savedFetch
        process.env.VAPID_PUBLIC_KEY = savedVapid.publicKey
        process.env.VAPID_PRIVATE_KEY = savedVapid.privateKey
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    beforeEach(async () => {
        await prisma.pushSubscription.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.authSession.deleteMany({ where: { userId, id: { not: other.id } } })
        await prisma.user.update({ where: { id: userId }, data: { notifyPush: false } })
    })

    it('POST /auth/signout stops the push of that browser, not of the others', async () => {
        const laptop = await browserWithPush('laptop')
        const phone = await browserWithPush('phone')

        const res = await authed(laptop.token).post('/auth/signout')
        expect(res.status).toBe(200)

        expect(await endpointsLeft()).toEqual([phone.endpoint])
        expect(await pushFailedSession()).toEqual([phone.endpoint])
        // push stays on for the account while another browser has it
        const profile = await authed(phone.token).get('/setting')
        expect(profile.body.data.notifyPush).toBe(true)
    })

    it('DELETE /auth/sessions/:id stops the push of the device that is signed out', async () => {
        const laptop = await browserWithPush('laptop')
        const phone = await browserWithPush('phone')

        const res = await authed(laptop.token).delete(`/auth/sessions/${phone.id}`)
        expect(res.status).toBe(200)

        expect(await endpointsLeft()).toEqual([laptop.endpoint])
        expect(await pushFailedSession()).toEqual([laptop.endpoint])
    })

    it('POST /auth/signout/all stops every push and turns push off for the account', async () => {
        await browserWithPush('laptop')
        const phone = await browserWithPush('phone')

        const res = await authed(phone.token).post('/auth/signout/all')
        expect(res.status).toBe(200)

        expect(await endpointsLeft()).toEqual([])
        expect(await pushFailedSession()).toEqual([])
        const row = await prisma.user.findUnique({ where: { id: userId } })
        expect(row?.notifyPush).toBe(false)
    })

    it('signing out the last browser with push turns push off for the account', async () => {
        const laptop = await browserWithPush('laptop')
        const noPush = await signIn(userId)

        await authed(laptop.token).post('/auth/signout')

        const profile = await authed(noPush.token).get('/setting')
        expect(profile.body.data.notifyPush).toBe(false)
    })

    it('a browser whose sign-in ended gets no push', async () => {
        const laptop = await browserWithPush('laptop')
        const phone = await browserWithPush('phone')
        // the sign-in of the phone ran out; nobody signed it out
        await prisma.authSession.update({
            where: { id: phone.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
        })

        expect(await pushFailedSession()).toEqual([laptop.endpoint])
    })

    it('POST /notification/push/status tells a browser if it has push for this user', async () => {
        const laptop = await browserWithPush('laptop')

        const mine = await authed(laptop.token).post('/notification/push/status', {
            endpoint: laptop.endpoint,
        })
        expect(mine.status).toBe(200)
        expect(mine.body.data).toEqual({ subscribed: true })

        // the next user on the same browser: the browser still has the endpoint
        const next = await authed(other.token).post('/notification/push/status', {
            endpoint: laptop.endpoint,
        })
        expect(next.status).toBe(200)
        expect(next.body.data).toEqual({ subscribed: false })

        const none = await authed(laptop.token).post('/notification/push/status', {
            endpoint: endpointOf(`never-${stamp}`),
        })
        expect(none.body.data).toEqual({ subscribed: false })

        const bad = await authed(laptop.token).post('/notification/push/status', {})
        expect(bad.status).toBe(400)
    })

    it('push turned on by the next user on a browser moves that browser to them', async () => {
        const laptop = await browserWithPush('laptop')

        const res = await authed(other.token).post('/notification/push/subscribe', {
            endpoint: laptop.endpoint,
            keys: browserKeys(),
        })
        expect(res.status).toBe(201)

        expect(await endpointsLeft()).toEqual([])
        expect(await pushFailedSession()).toEqual([])
        // signing out the first user's old sign-in does not take the browser from the next user
        await authed(laptop.token).post('/auth/signout')
        expect(await prisma.pushSubscription.count({ where: { userId: otherUserId } })).toBe(1)
    })
})
