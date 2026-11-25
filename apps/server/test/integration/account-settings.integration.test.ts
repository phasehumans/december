import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { describeUserAgent, generateAccessToken } from '../../src/modules/auth/auth.utils'
import { appCache } from '../../src/shared/cache'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const DAY_MS = 24 * 60 * 60 * 1000

const CHROME_WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
const SAFARI_IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const CLI_LINUX = 'december-cli/0.4.22 (linux; x64)'

/** a signed-in session with a user agent, and a bearer token for it */
const createAuthSession = async (data: {
    userId: string
    userAgent: string
    expiresAt?: Date
    isRevoked?: boolean
}) => {
    const { userId, userAgent, expiresAt, isRevoked = false } = data
    const session = await prisma.authSession.create({
        data: {
            userId,
            userAgent,
            refreshTokenHash: `test-hash-${crypto.randomUUID()}`,
            expiresAt: expiresAt ?? new Date(Date.now() + 7 * DAY_MS),
            isRevoked,
        },
    })
    return { id: session.id, token: generateAccessToken({ userId, sessionId: session.id }) }
}

const authed = (token: string) => ({
    get: (path: string) =>
        request(app)
            .get(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`),
    patch: (path: string, body: object) =>
        request(app)
            .patch(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body),
    delete: (path: string) =>
        request(app)
            .delete(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`),
})

// #636 parts 1, 4 and 5: devices, support access and preferences on the account page
describe('account settings api', () => {
    const stamp = Date.now()
    const adminEmail = `account-admin-${stamp}@example.com`
    const savedAdminEmails = process.env.ADMIN_EMAILS
    const userIds: string[] = []

    let admin: { userId: string; token: string }
    let other: { userId: string; token: string }

    beforeAll(async () => {
        process.env.ADMIN_EMAILS = adminEmail
        admin = await createSignedInUser({ email: adminEmail })
        other = await createSignedInUser({ email: `account-other-${stamp}@example.com` })
        userIds.push(admin.userId, other.userId)
    })

    afterAll(async () => {
        process.env.ADMIN_EMAILS = savedAdminEmails
        await prisma.adminAuditLog.deleteMany({ where: { adminUserId: admin.userId } })
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    describe('device labels', () => {
        it('names the browser and system, and the cli', () => {
            expect(describeUserAgent(CHROME_WINDOWS)).toEqual({
                kind: 'web',
                label: 'Chrome on Windows',
            })
            expect(describeUserAgent(SAFARI_IPHONE)).toEqual({
                kind: 'web',
                label: 'Safari on iPhone',
            })
            expect(describeUserAgent(CLI_LINUX)).toEqual({
                kind: 'cli',
                label: 'December CLI on Linux',
            })
            expect(describeUserAgent('december-cli/0.4.22 (darwin; arm64)').label).toBe(
                'December CLI on macOS'
            )
            // an older cli that sent no user agent of its own (see pollDeviceToken)
            expect(describeUserAgent('device-cli (Bun/1.3.0)')).toEqual({
                kind: 'cli',
                label: 'December CLI',
            })
            expect(describeUserAgent(null)).toEqual({ kind: 'web', label: 'Browser' })
        })
    })

    describe('devices', () => {
        let userId: string
        let web: { id: string; token: string }
        let phone: { id: string; token: string }
        let cli: { id: string; token: string }

        beforeAll(async () => {
            const user = await prisma.user.create({
                data: {
                    email: `account-devices-${stamp}@example.com`,
                    name: 'Devices',
                    emailVerified: true,
                },
            })
            userId = user.id
            userIds.push(userId)
            cli = await createAuthSession({ userId, userAgent: CLI_LINUX })
            phone = await createAuthSession({ userId, userAgent: SAFARI_IPHONE })
            web = await createAuthSession({ userId, userAgent: CHROME_WINDOWS })
            // neither shows in the list
            await createAuthSession({
                userId,
                userAgent: CHROME_WINDOWS,
                expiresAt: new Date(Date.now() - 1000),
            })
            await createAuthSession({ userId, userAgent: CHROME_WINDOWS, isRevoked: true })
        })

        it('GET /auth/sessions lists the live sessions, this device first', async () => {
            const res = await authed(web.token).get('/auth/sessions')

            expect(res.status).toBe(200)
            const rows = res.body.data as Array<Record<string, unknown>>
            expect(rows.map((row) => row.id)).toHaveLength(3)
            expect(rows[0]).toMatchObject({
                id: web.id,
                label: 'Chrome on Windows',
                kind: 'web',
                isCurrent: true,
            })
            expect(rows.find((row) => row.id === cli.id)).toMatchObject({
                label: 'December CLI on Linux',
                kind: 'cli',
                isCurrent: false,
            })
            expect(rows.find((row) => row.id === phone.id)?.label).toBe('Safari on iPhone')
            expect(typeof rows[0]?.lastActiveAt).toBe('string')
            expect(typeof rows[0]?.createdAt).toBe('string')
        })

        it('DELETE /auth/sessions/:id signs out another device', async () => {
            const res = await authed(web.token).delete(`/auth/sessions/${phone.id}`)

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ id: phone.id, isCurrent: false })
            expect(res.headers['set-cookie']).toBeUndefined()

            const row = await prisma.authSession.findUnique({ where: { id: phone.id } })
            expect(row?.isRevoked).toBe(true)
            expect(row?.revokedAt).not.toBeNull()

            // the signed-out device cannot call the api anymore
            const phoneRes = await authed(phone.token).get('/auth/sessions')
            expect(phoneRes.status).toBe(401)

            const list = await authed(web.token).get('/auth/sessions')
            expect(list.body.data.map((row: { id: string }) => row.id)).not.toContain(phone.id)
        })

        it('answers 404 for a session that is signed out already', async () => {
            const res = await authed(web.token).delete(`/auth/sessions/${phone.id}`)
            expect(res.status).toBe(404)
        })

        it("answers 404 for another user's session and leaves it signed in", async () => {
            const res = await authed(other.token).delete(`/auth/sessions/${cli.id}`)
            expect(res.status).toBe(404)

            const row = await prisma.authSession.findUnique({ where: { id: cli.id } })
            expect(row?.isRevoked).toBe(false)
        })

        it('answers 400 for an id that is not a uuid', async () => {
            const res = await authed(web.token).delete('/auth/sessions/not-a-uuid')
            expect(res.status).toBe(400)
        })

        it('signing out this device works like sign out', async () => {
            const res = await authed(web.token).delete(`/auth/sessions/${web.id}`)

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ id: web.id, isCurrent: true })
            const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
            expect(cookies.some((cookie) => cookie.startsWith('accessToken=;'))).toBe(true)

            const after = await authed(web.token).get('/auth/sessions')
            expect(after.status).toBe(401)

            // the cli is still signed in
            const cliList = await authed(cli.token).get('/auth/sessions')
            expect(cliList.status).toBe(200)
            expect(cliList.body.data).toHaveLength(1)
        })

        it('needs a signed-in user', async () => {
            const res = await request(app)
                .get('/api/v1/auth/sessions')
                .set('x-forwarded-for', getRandomIP())
            expect(res.status).toBe(401)
        })
    })

    describe('support access', () => {
        let user: { userId: string; token: string }
        let sessionId: string
        let otherSessionId: string

        const adminGet = (token: string, path: string) =>
            authed(token).get(`/admin/users/${user.userId}${path}`)

        beforeAll(async () => {
            user = await createSignedInUser({ email: `account-support-${stamp}@example.com` })
            userIds.push(user.userId)
            const session = await prisma.session.create({
                data: {
                    userId: user.userId,
                    title: 'fix the login page',
                    messages: {
                        create: [
                            { role: 'USER', content: 'the login page is blank', sequence: 1 },
                            { role: 'ASSISTANT', content: 'looking at it now', sequence: 2 },
                        ],
                    },
                },
            })
            sessionId = session.id
            const otherSession = await prisma.session.create({
                data: { userId: other.userId, title: 'not this one' },
            })
            otherSessionId = otherSession.id
        })

        it('is off for a new user, and the admin page cannot open sessions', async () => {
            const profile = await authed(user.token).get('/setting')
            expect(profile.body.data.supportAccessUntil).toBeNull()

            const list = await adminGet(admin.token, '/sessions')
            expect(list.status).toBe(403)
            const open = await adminGet(admin.token, `/sessions/${sessionId}`)
            expect(open.status).toBe(403)
        })

        it('PATCH /setting/support-access turns it on for 7 days', async () => {
            const before = Date.now()
            const res = await authed(user.token).patch('/setting/support-access', {
                enabled: true,
            })

            expect(res.status).toBe(200)
            const until = new Date(res.body.data.supportAccessUntil).getTime()
            expect(until).toBeGreaterThanOrEqual(before + 7 * DAY_MS)
            expect(until).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS)

            const profile = await authed(user.token).get('/setting')
            expect(profile.body.data.supportAccessUntil).toBe(res.body.data.supportAccessUntil)

            const detail = await adminGet(admin.token, '')
            expect(detail.body.data.supportAccessUntil).toBe(res.body.data.supportAccessUntil)
        })

        it('the admin page lists the sessions and opens one, with a log row', async () => {
            const list = await adminGet(admin.token, '/sessions')
            expect(list.status).toBe(200)
            expect(list.body.data.items.map((item: { id: string }) => item.id)).toEqual([sessionId])

            const open = await adminGet(admin.token, `/sessions/${sessionId}`)
            expect(open.status).toBe(200)
            expect(open.body.data.title).toBe('fix the login page')
            expect(
                open.body.data.messages.map((message: { content: string }) => message.content)
            ).toEqual(['the login page is blank', 'looking at it now'])

            const logs = await prisma.adminAuditLog.findMany({
                where: { adminUserId: admin.userId, action: 'support.session.open' },
            })
            expect(logs).toHaveLength(1)
            expect(logs[0]).toMatchObject({ targetType: 'session', targetId: sessionId })
            expect(logs[0]?.metadata).toEqual({ userId: user.userId })
        })

        it("cannot open another user's session through this user", async () => {
            const res = await adminGet(admin.token, `/sessions/${otherSessionId}`)
            expect(res.status).toBe(404)
        })

        it('is for admins only', async () => {
            const res = await adminGet(other.token, `/sessions/${sessionId}`)
            expect(res.status).toBe(403)
        })

        it('closes when the 7 days are over', async () => {
            await prisma.user.update({
                where: { id: user.userId },
                data: { supportAccessUntil: new Date(Date.now() - 1000) },
            })
            const res = await adminGet(admin.token, `/sessions/${sessionId}`)
            expect(res.status).toBe(403)
        })

        it('PATCH /setting/support-access turns it off', async () => {
            await authed(user.token).patch('/setting/support-access', { enabled: true })
            const res = await authed(user.token).patch('/setting/support-access', {
                enabled: false,
            })

            expect(res.status).toBe(200)
            expect(res.body.data.supportAccessUntil).toBeNull()
            const list = await adminGet(admin.token, '/sessions')
            expect(list.status).toBe(403)
        })

        it('needs a boolean', async () => {
            const res = await authed(user.token).patch('/setting/support-access', {
                enabled: 'yes',
            })
            expect(res.status).toBe(400)
        })
    })

    describe('preferences', () => {
        let user: { userId: string; token: string }

        beforeAll(async () => {
            user = await createSignedInUser({ email: `account-prefs-${stamp}@example.com` })
            userIds.push(user.userId)
        })

        it('are null until the user saves one', async () => {
            const res = await authed(user.token).get('/setting')
            expect(res.body.data.preferences).toBeNull()
        })

        it('PATCH /setting/preferences saves one value at a time and merges', async () => {
            const first = await authed(user.token).patch('/setting/preferences', {
                sendKey: 'mod-enter',
            })
            expect(first.status).toBe(200)
            expect(first.body.data.preferences).toEqual({ sendKey: 'mod-enter' })

            const second = await authed(user.token).patch('/setting/preferences', {
                soundOnFinish: true,
                messageWhileWorking: 'send',
            })
            expect(second.status).toBe(200)
            expect(second.body.data.preferences).toEqual({
                sendKey: 'mod-enter',
                soundOnFinish: true,
                messageWhileWorking: 'send',
            })

            // the profile is the one other devices read
            const profile = await authed(user.token).get('/setting')
            expect(profile.body.data.preferences).toEqual(second.body.data.preferences)
        })

        it('drops saved values that are no longer valid', async () => {
            await prisma.user.update({
                where: { id: user.userId },
                data: { preferences: { sendKey: 'shift-enter', soundOnFinish: false, old: 1 } },
            })
            // the profile is cached; a direct database write does not clear it
            await appCache.del(appCache.key('setting', 'profile', user.userId))
            const profile = await authed(user.token).get('/setting')
            expect(profile.body.data.preferences).toEqual({ soundOnFinish: false })
        })

        it('refuses an empty body, a bad value and an unknown key', async () => {
            const empty = await authed(user.token).patch('/setting/preferences', {})
            expect(empty.status).toBe(400)

            const bad = await authed(user.token).patch('/setting/preferences', {
                sendKey: 'space',
            })
            expect(bad.status).toBe(400)

            const unknown = await authed(user.token).patch('/setting/preferences', {
                theme: 'dark',
            })
            expect(unknown.status).toBe(400)
        })
    })
})
