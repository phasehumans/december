import { prisma } from '@december/database'
import { setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { generateAccessToken } from '../../src/modules/auth/auth.utils'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const DAY_MS = 24 * 60 * 60 * 1000

const authed = (token: string) => ({
    get: (path: string) =>
        request(app)
            .get(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`),
    patch: (path: string, body: unknown) =>
        request(app)
            .patch(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body as object),
    post: (path: string, body: object = {}) =>
        request(app)
            .post(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body),
    delete: (path: string, body?: object) => {
        const req = request(app)
            .delete(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
        return body ? req.send(body) : req
    },
})

const anonymous = (method: 'get' | 'patch' | 'post' | 'delete', path: string) =>
    request(app)[method](`/api/v1${path}`).set('x-forwarded-for', getRandomIP())

/** one more signed-in device for a user */
const addDevice = async (userId: string) => {
    const session = await prisma.authSession.create({
        data: {
            userId,
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/133.0',
            refreshTokenHash: `test-hash-${crypto.randomUUID()}`,
            expiresAt: new Date(Date.now() + 7 * DAY_MS),
        },
    })
    return { id: session.id, token: generateAccessToken({ userId, sessionId: session.id }) }
}

// every endpoint the Account page calls: profile, name, notifications, preferences,
// devices, sign out everywhere and delete account
describe('account page api', () => {
    const stamp = Date.now()
    const userIds: string[] = []
    const queuedJobs: Array<{ name: string; data: any }> = []

    const newUser = async (label: string, name = 'Account User') => {
        const user = await createSignedInUser({
            email: `account-${label}-${stamp}@example.com`,
            name,
        })
        userIds.push(user.userId)
        return user
    }

    beforeAll(() => {
        setAgentQueue({
            add: async (name: string, data: any) => {
                queuedJobs.push({ name, data })
                return { id: `job-${queuedJobs.length}` }
            },
        } as any)
    })

    afterAll(async () => {
        setAgentQueue(null)
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    describe('every endpoint needs a sign-in', () => {
        const routes: Array<['get' | 'patch' | 'post' | 'delete', string]> = [
            ['get', '/setting'],
            ['get', '/setting/me'],
            ['patch', '/setting/name'],
            ['patch', '/setting/notifications'],
            ['patch', '/setting/preferences'],
            ['get', '/auth/sessions'],
            ['delete', `/auth/sessions/${crypto.randomUUID()}`],
            ['post', '/auth/signout'],
            ['post', '/auth/signout/all'],
            ['delete', '/auth/account'],
            ['delete', '/session'],
            ['post', '/setting/feedback'],
        ]
        for (const [method, path] of routes) {
            it(`${method.toUpperCase()} ${path} answers 401`, async () => {
                const res = await anonymous(method, path)
                expect(res.status).toBe(401)
            })
        }

        it('a token signed with another secret answers 401', async () => {
            const res = await request(app)
                .get('/api/v1/setting')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', 'Bearer not.a.real.token')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /setting and GET /setting/me', () => {
        it('returns the profile without any secret field', async () => {
            const user = await newUser('profile', 'Ada Lovelace')
            await prisma.user.update({
                where: { id: user.userId },
                data: {
                    githubToken: 'gho_secret',
                    otpHash: 'hash',
                    otpExpiresAt: new Date(),
                    otpAttempts: 2,
                },
            })

            const res = await authed(user.token).get('/setting')

            expect(res.status).toBe(200)
            const profile = res.body.data
            expect(profile.id).toBe(user.userId)
            expect(profile.name).toBe('Ada Lovelace')
            expect(profile.email).toBe(`account-profile-${stamp}@example.com`)
            for (const secret of [
                'githubToken',
                'otpHash',
                'otpExpiresAt',
                'otpAttempts',
                'password',
            ]) {
                expect(profile).not.toHaveProperty(secret)
            }
            // not an admin: no flag and no path to the panel
            expect(profile.isAdmin).toBe(false)
            expect(profile).not.toHaveProperty('adminPath')
        })

        it('GET /setting/me gives the name and the github state', async () => {
            const user = await newUser('me', 'Grace Hopper')
            const res = await authed(user.token).get('/setting/me')
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ fullName: 'Grace Hopper', isGithubConnected: false })
        })

        it("shows only the signed-in user's profile", async () => {
            const one = await newUser('iso-one', 'User One')
            const two = await newUser('iso-two', 'User Two')
            expect((await authed(one.token).get('/setting')).body.data.name).toBe('User One')
            expect((await authed(two.token).get('/setting')).body.data.name).toBe('User Two')
        })
    })

    describe('PATCH /setting/name', () => {
        it('saves the name, trimmed, and the cached profile shows it at once', async () => {
            const user = await newUser('name')
            // fill the cache first
            await authed(user.token).get('/setting')
            await authed(user.token).get('/setting/me')

            const res = await authed(user.token).patch('/setting/name', { name: '  Ada L  ' })

            expect(res.status).toBe(200)
            expect(res.body.data.name).toBe('Ada L')
            expect((await authed(user.token).get('/setting')).body.data.name).toBe('Ada L')
            expect((await authed(user.token).get('/setting/me')).body.data.fullName).toBe('Ada L')
        })

        it('takes 3 to 20 characters after the trim', async () => {
            const user = await newUser('name-len')
            expect((await authed(user.token).patch('/setting/name', { name: 'Ada' })).status).toBe(
                200
            )
            expect(
                (await authed(user.token).patch('/setting/name', { name: 'a'.repeat(20) })).status
            ).toBe(200)
        })

        it('refuses a bad name and keeps the old one', async () => {
            const user = await newUser('name-bad', 'Keep Me')
            const bad: unknown[] = [
                {},
                { name: '' },
                { name: 'ab' },
                // only spaces around two letters: too short after the trim
                { name: '   ab   ' },
                { name: '     ' },
                { name: 'a'.repeat(21) },
                { name: 123 },
                { name: null },
                { name: ['Ada Lovelace'] },
            ]
            for (const body of bad) {
                const res = await authed(user.token).patch('/setting/name', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
            const saved = await prisma.user.findUnique({ where: { id: user.userId } })
            expect(saved?.name).toBe('Keep Me')
        })

        it("changes only the signed-in user's name", async () => {
            const one = await newUser('name-one', 'First One')
            const two = await newUser('name-two', 'Second Two')
            await authed(one.token).patch('/setting/name', { name: 'Changed' })
            const other = await prisma.user.findUnique({ where: { id: two.userId } })
            expect(other?.name).toBe('Second Two')
        })
    })

    describe('PATCH /setting/notifications', () => {
        it('saves each field alone and keeps the others', async () => {
            const user = await newUser('notify')

            let res = await authed(user.token).patch('/setting/notifications', {
                notifyLevel: 'ALL',
            })
            expect(res.status).toBe(200)

            res = await authed(user.token).patch('/setting/notifications', {
                notifyProductUpdates: false,
            })
            expect(res.status).toBe(200)

            res = await authed(user.token).patch('/setting/notifications', {
                timezone: 'Asia/Kolkata',
            })
            expect(res.status).toBe(200)

            const profile = (await authed(user.token).get('/setting')).body.data
            expect(profile.notifyLevel).toBe('ALL')
            expect(profile.notifyProductUpdates).toBe(false)
            expect(profile.timezone).toBe('Asia/Kolkata')
            expect(profile.notifySecurityAlerts).toBe(true)
        })

        it('takes every level', async () => {
            const user = await newUser('notify-levels')
            for (const notifyLevel of ['ALL', 'IMPORTANT', 'NONE']) {
                const res = await authed(user.token).patch('/setting/notifications', {
                    notifyLevel,
                })
                expect(res.status).toBe(200)
                expect((await authed(user.token).get('/setting')).body.data.notifyLevel).toBe(
                    notifyLevel
                )
            }
        })

        it('refuses bad values, unknown keys and an empty body', async () => {
            const user = await newUser('notify-bad')
            const bad: unknown[] = [
                {},
                { notifyLevel: 'SOME' },
                { notifyLevel: 'all' },
                { notifyProductUpdates: 'no' },
                // security alerts stay on
                { notifySecurityAlerts: false },
                // push is turned on from the browser only
                { notifyPush: true },
                { timezone: 'Mars/Olympus' },
                { timezone: '' },
                { timezone: 'a'.repeat(65) },
                // strict: a field the page does not have
                { notifyLevel: 'ALL', isAdmin: true },
                { creditBalance: 1_000_000 },
            ]
            for (const body of bad) {
                const res = await authed(user.token).patch('/setting/notifications', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
            const saved = await prisma.user.findUnique({ where: { id: user.userId } })
            expect(saved?.notifyLevel).toBe('IMPORTANT')
            expect(saved?.notifySecurityAlerts).toBe(true)
            expect(saved?.creditBalance).toBe(0)
        })

        it('takes security alerts on and push off, which change nothing', async () => {
            const user = await newUser('notify-ok')
            const res = await authed(user.token).patch('/setting/notifications', {
                notifySecurityAlerts: true,
                notifyPush: false,
            })
            expect(res.status).toBe(200)
        })
    })

    describe('PATCH /setting/preferences', () => {
        it('saves on the account, so another device of the user reads it', async () => {
            const user = await newUser('prefs')
            const phone = await addDevice(user.userId)

            await authed(user.token).patch('/setting/preferences', { sendKey: 'mod-enter' })
            await authed(phone.token).patch('/setting/preferences', { soundOnFinish: true })

            const res = await authed(phone.token).get('/setting')
            expect(res.body.data.preferences).toEqual({ sendKey: 'mod-enter', soundOnFinish: true })
        })

        it('refuses unknown keys and bad values', async () => {
            const user = await newUser('prefs-bad')
            for (const body of [
                { sendKey: 'shift-enter' },
                { soundOnFinish: 'yes' },
                { messageWhileWorking: 'later' },
            ]) {
                const res = await authed(user.token).patch('/setting/preferences', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
            const saved = await prisma.user.findUnique({ where: { id: user.userId } })
            expect(saved?.preferences).toBeNull()
        })
    })

    describe('POST /setting/feedback', () => {
        it('takes up to 5000 characters, trimmed', async () => {
            const user = await newUser('feedback')
            const res = await authed(user.token).post('/setting/feedback', {
                rating: 'happy',
                feedback: `  ${'a'.repeat(5000)}  `,
            })
            expect(res.status).toBe(200)
            const row = await prisma.feedback.findFirst({ where: { userId: user.userId } })
            expect(row?.feedback).toHaveLength(5000)
        })

        it('refuses empty, too long and bad feedback, and saves nothing', async () => {
            const user = await newUser('feedback-bad')
            for (const body of [
                {},
                { rating: null, feedback: '' },
                { rating: null, feedback: '    ' },
                { rating: null, feedback: 'a'.repeat(5001) },
                { rating: 'angry', feedback: 'hi' },
                { rating: null, feedback: 42 },
            ]) {
                const res = await authed(user.token).post('/setting/feedback', body)
                const label = {
                    ...body,
                    feedback: String((body as any).feedback ?? '').slice(0, 20),
                }
                expect({ label, status: res.status }).toEqual({ label, status: 400 })
            }
            expect(await prisma.feedback.count({ where: { userId: user.userId } })).toBe(0)
        })
    })

    describe('devices', () => {
        it('a device that is signed out cannot use its token', async () => {
            const user = await newUser('device')
            const laptop = await addDevice(user.userId)

            expect((await authed(laptop.token).get('/setting')).status).toBe(200)
            const res = await authed(user.token).delete(`/auth/sessions/${laptop.id}`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ id: laptop.id, isCurrent: false })

            expect((await authed(laptop.token).get('/setting')).status).toBe(401)
            // this device stays signed in
            expect((await authed(user.token).get('/setting')).status).toBe(200)
        })

        it('the list leaves out expired and signed-out sessions', async () => {
            const user = await newUser('device-list')
            const live = await addDevice(user.userId)
            const gone = await addDevice(user.userId)
            await prisma.authSession.update({
                where: { id: gone.id },
                data: { isRevoked: true, revokedAt: new Date() },
            })
            const expired = await prisma.authSession.create({
                data: {
                    userId: user.userId,
                    refreshTokenHash: `test-hash-${crypto.randomUUID()}`,
                    expiresAt: new Date(Date.now() - 1000),
                },
            })

            const res = await authed(user.token).get('/auth/sessions')
            const ids = res.body.data.map((row: { id: string }) => row.id)
            expect(ids).toContain(live.id)
            expect(ids).not.toContain(gone.id)
            expect(ids).not.toContain(expired.id)
            expect(res.body.data[0].isCurrent).toBe(true)
            expect(
                res.body.data.filter((row: { isCurrent: boolean }) => row.isCurrent)
            ).toHaveLength(1)
        })

        it("cannot see or sign out another user's devices", async () => {
            const one = await newUser('device-one')
            const two = await newUser('device-two')
            const twoLaptop = await addDevice(two.userId)

            const list = await authed(one.token).get('/auth/sessions')
            const ids = list.body.data.map((row: { id: string }) => row.id)
            expect(ids).not.toContain(twoLaptop.id)

            const res = await authed(one.token).delete(`/auth/sessions/${twoLaptop.id}`)
            expect(res.status).toBe(404)
            expect((await authed(twoLaptop.token).get('/setting')).status).toBe(200)
        })
    })

    describe('POST /auth/signout/all', () => {
        it('signs out every device of the user and no other user', async () => {
            const user = await newUser('signout-all')
            const laptop = await addDevice(user.userId)
            const phone = await addDevice(user.userId)
            const other = await newUser('signout-all-other')

            const res = await authed(user.token).post('/auth/signout/all')
            expect(res.status).toBe(200)

            for (const token of [user.token, laptop.token, phone.token]) {
                expect((await authed(token).get('/setting')).status).toBe(401)
            }
            expect((await authed(other.token).get('/setting')).status).toBe(200)
            expect(
                await prisma.authSession.count({ where: { userId: user.userId, isRevoked: false } })
            ).toBe(0)
        })
    })

    describe('DELETE /auth/account', () => {
        it('signs out every device, blocks sign-in and keeps other users', async () => {
            const user = await newUser('delete')
            const laptop = await addDevice(user.userId)
            const other = await newUser('delete-other')

            const res = await authed(user.token).delete('/auth/account')
            expect(res.status).toBe(200)

            for (const token of [user.token, laptop.token]) {
                expect((await authed(token).get('/setting')).status).toBe(401)
                expect((await authed(token).delete('/auth/account')).status).toBe(401)
            }
            expect((await authed(other.token).get('/setting')).status).toBe(200)

            const saved = await prisma.user.findUnique({ where: { id: user.userId } })
            expect(saved?.isDeleted).toBe(true)
            expect(saved?.deletedAt).toBeInstanceOf(Date)

            // the email cannot get a sign-in code until the purge
            const start = await request(app)
                .post('/api/v1/auth/email/start')
                .set('x-forwarded-for', getRandomIP())
                .send({ email: `account-delete-${stamp}@example.com` })
            expect(start.status).toBe(403)
        })

        it('removes keys, git connections and github tokens for real', async () => {
            const user = await newUser('delete-keys')
            await prisma.user.update({
                where: { id: user.userId },
                data: { githubToken: 'gho_secret', githubConnected: true, githubUsername: 'ada' },
            })
            await prisma.providerCredential.create({
                data: {
                    userId: user.userId,
                    provider: 'groq',
                    encryptedKey: 'encrypted',
                    keyHint: '1234',
                    models: ['llama-3.3-70b-versatile'],
                    defaultModel: 'llama-3.3-70b-versatile',
                    verifiedAt: new Date(),
                },
            })
            await prisma.gitConnection.create({
                data: {
                    userId: user.userId,
                    provider: 'GITLAB',
                    externalId: `gl-${stamp}`,
                    username: 'ada',
                    encryptedAccessToken: 'encrypted',
                },
            })

            expect((await authed(user.token).delete('/auth/account')).status).toBe(200)

            expect(await prisma.providerCredential.count({ where: { userId: user.userId } })).toBe(
                0
            )
            expect(await prisma.gitConnection.count({ where: { userId: user.userId } })).toBe(0)
            const saved = await prisma.user.findUnique({ where: { id: user.userId } })
            expect(saved?.githubToken).toBeNull()
            expect(saved?.githubConnected).toBe(false)
            expect(saved?.githubUsername).toBeNull()
        })
    })
})
