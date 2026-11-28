import { prisma } from '@december/database'
import { afterAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { buildUnsubscribeUrl, createUnsubscribeToken } from '../../src/modules/admin/admin.utils'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// every route of the setting module (setting.routes.ts) that the other setting*, account*
// and session-defaults files do not cover yet: sign-in on every route, the public
// unsubscribe link, strict bodies, one user never reaching another, and no secret in a
// response.

type Method = 'get' | 'post' | 'patch' | 'put'

const authed = (token: string) => (method: Method, path: string, body?: unknown) => {
    const req = request(app)
        [method](`/api/v1/setting${path}`)
        .set('x-forwarded-for', getRandomIP())
        .set('Authorization', `Bearer ${token}`)
    return body === undefined ? req : req.send(body as object)
}

const anonymous = (method: Method, path: string) =>
    request(app)[method](`/api/v1/setting${path}`).set('x-forwarded-for', getRandomIP())

const SECRET_WORDS = [
    'githubToken',
    'otpHash',
    'otpAttempts',
    'refreshTokenHash',
    'encryptedKey',
    'encryptedAccessToken',
    'encryptedRefreshToken',
    'googleId',
    'githubId',
    'password',
]

describe('setting routes', () => {
    const stamp = Date.now()
    const userIds: string[] = []

    const newUser = async (label: string, name = 'Setting User') => {
        const user = await createSignedInUser({
            email: `setting-routes-${label}-${stamp}@example.com`,
            name,
        })
        userIds.push(user.userId)
        return { ...user, call: authed(user.token) }
    }

    afterAll(async () => {
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    describe('every route but unsubscribe needs a sign-in', () => {
        const routes: Array<[Method, string]> = [
            ['get', '/me'],
            ['get', '/'],
            ['patch', '/name'],
            ['patch', '/notifications'],
            ['patch', '/defaults'],
            ['get', '/permissions'],
            ['put', '/permissions'],
            ['patch', '/preferences'],
            ['get', '/pull-requests'],
            ['patch', '/pull-requests'],
            ['get', '/sandbox'],
            ['patch', '/sandbox'],
            ['get', '/onboarding'],
            ['patch', '/onboarding'],
            ['post', '/onboarding/complete'],
            ['post', '/feedback'],
        ]
        for (const [method, path] of routes) {
            it(`${method.toUpperCase()} /setting${path} answers 401`, async () => {
                expect((await anonymous(method, path)).status).toBe(401)
                const forged = await request(app)
                    [method](`/api/v1/setting${path}`)
                    .set('x-forwarded-for', getRandomIP())
                    .set('Authorization', 'Bearer not.a.token')
                expect(forged.status).toBe(401)
            })
        }

        it('the removed routes are gone', async () => {
            const user = await newUser('gone')
            expect((await user.call('patch', '/model-source', { source: 'CREDITS' })).status).toBe(
                404
            )
            expect(
                (await user.call('put', '/sandbox/setup-commands', { commands: [] })).status
            ).toBe(404)
        })
    })

    describe('GET and POST /setting/unsubscribe (signed link, no sign-in)', () => {
        const linkOf = (userId: string) => {
            const url = new URL(buildUnsubscribeUrl(userId))
            return {
                path: url.pathname,
                u: url.searchParams.get('u') as string,
                t: url.searchParams.get('t') as string,
            }
        }
        const productEmails = async (userId: string) =>
            (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).notifyProductUpdates

        it('GET with a good link shows the form and changes nothing', async () => {
            const user = await newUser('unsub-get')
            const { u, t } = linkOf(user.userId)
            const res = await anonymous('get', `/unsubscribe?u=${u}&t=${t}`)
            expect(res.status).toBe(200)
            expect(res.headers['content-type']).toContain('text/html')
            expect(res.text).toContain('method="post"')
            expect(res.text).toContain(`value="${u}"`)
            expect(await productEmails(user.userId)).toBe(true)
        })

        it('GET with a bad, tampered, foreign or missing token answers a 400 page', async () => {
            const user = await newUser('unsub-bad')
            const other = await newUser('unsub-other')
            const { t } = linkOf(user.userId)
            const flipped = `${t.slice(0, -1)}${t.endsWith('0') ? '1' : '0'}`
            for (const query of [
                '',
                `?u=${user.userId}`,
                `?t=${t}`,
                `?u=${user.userId}&t=${flipped}`,
                `?u=${user.userId}&t=${t.slice(0, -2)}`,
                `?u=${user.userId}&t=${t}00`,
                `?u=${user.userId}&t=${createUnsubscribeToken(other.userId)}`,
                `?u=${other.userId}&t=${t}`,
                `?u=${user.userId}&t=${'x'.repeat(201)}`,
                `?u=${user.userId}&t[]=${t}`,
                `?u=${user.userId}&u=${other.userId}&t=${t}`,
            ]) {
                const res = await anonymous('get', `/unsubscribe${query}`)
                expect({ query, status: res.status }).toEqual({ query, status: 400 })
                expect(res.headers['content-type']).toContain('text/html')
                expect(res.text).toContain('not valid')
                expect(res.text).not.toContain('method="post"')
            }
            expect(await productEmails(user.userId)).toBe(true)
            expect(await productEmails(other.userId)).toBe(true)
        })

        it('the page never echoes markup from the link', async () => {
            const res = await anonymous(
                'get',
                `/unsubscribe?u=${encodeURIComponent('"><script>alert(1)</script>')}&t=abc`
            )
            expect(res.status).toBe(400)
            expect(res.text).not.toContain('<script>')
        })

        it('POST with the form body turns product emails off, for that user only', async () => {
            const user = await newUser('unsub-post')
            const bystander = await newUser('unsub-bystander')
            const { path, u, t } = linkOf(user.userId)
            const res = await request(app)
                .post(path)
                .set('x-forwarded-for', getRandomIP())
                .type('form')
                .send({ u, t })
            expect(res.status).toBe(200)
            expect(res.headers['content-type']).toContain('text/html')
            expect(await productEmails(user.userId)).toBe(false)
            expect(await productEmails(bystander.userId)).toBe(true)

            // the link still works a second time, and changes nothing more
            const again = await request(app)
                .post(path)
                .set('x-forwarded-for', getRandomIP())
                .type('form')
                .send({ u, t })
            expect(again.status).toBe(200)
            expect(await productEmails(user.userId)).toBe(false)
        })

        it('POST with JSON works too, and a sign-in of another user changes nothing', async () => {
            const user = await newUser('unsub-json')
            const other = await newUser('unsub-json-other')
            const { u, t } = linkOf(user.userId)
            const res = await other.call('post', '/unsubscribe', { u, t })
            expect(res.status).toBe(200)
            expect(await productEmails(user.userId)).toBe(false)
            expect(await productEmails(other.userId)).toBe(true)
        })

        it('POST with a bad or foreign token answers a 400 page and changes nothing', async () => {
            const user = await newUser('unsub-post-bad')
            const other = await newUser('unsub-post-other')
            const { t } = linkOf(other.userId)
            for (const body of [
                {},
                { u: user.userId },
                { u: user.userId, t },
                { u: user.userId, t: 'f'.repeat(64) },
                { u: user.userId, t: '' },
                { u: user.userId, t: { $ne: '' } },
                { u: [user.userId], t },
            ]) {
                const res = await anonymous('post', '/unsubscribe').send(body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
                expect(res.text).toContain('not valid')
            }
            expect(await productEmails(user.userId)).toBe(true)
            expect(await productEmails(other.userId)).toBe(true)
        })

        it('a link of a user that is gone answers 400', async () => {
            const ghostId = crypto.randomUUID()
            const res = await anonymous('post', '/unsubscribe').send({
                u: ghostId,
                t: createUnsubscribeToken(ghostId),
            })
            expect(res.status).toBe(400)
        })
    })

    describe('GET /setting and GET /setting/me', () => {
        it('no secret or unused field, even when the account has them', async () => {
            const user = await newUser('secrets')
            await prisma.user.update({
                where: { id: user.userId },
                data: {
                    githubToken: 'gho_route_secret',
                    googleId: 'google-sub-123',
                    githubId: 'gh-id-123',
                    otpHash: 'otp-hash-value',
                    otpAttempts: 1,
                },
            })
            for (const path of ['/', '/me']) {
                const res = await user.call('get', path)
                expect(res.status).toBe(200)
                const raw = JSON.stringify(res.body.data)
                for (const word of [
                    ...SECRET_WORDS,
                    'gho_route_secret',
                    'google-sub-123',
                    'gh-id-123',
                    'otp-hash-value',
                    'isDeleted',
                ]) {
                    expect({ path, word, found: raw.includes(word) }).toEqual({
                        path,
                        word,
                        found: false,
                    })
                }
            }
        })
    })

    describe('PATCH /setting/name', () => {
        it('refuses unknown keys, control characters and other types, and keeps the name', async () => {
            const user = await newUser('name-strict', 'Kept Name')
            const other = await newUser('name-victim', 'Victim Name')
            for (const body of [
                { name: 'New Name', userId: other.userId },
                { name: 'New Name', id: other.userId },
                { name: 'Bad\nName' },
                { name: 'Bad\u0000Name' },
                { name: ['New Name'] },
                { name: null },
            ]) {
                const res = await user.call('patch', '/name', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
            const [mine, theirs] = await Promise.all([
                prisma.user.findUniqueOrThrow({ where: { id: user.userId } }),
                prisma.user.findUniqueOrThrow({ where: { id: other.userId } }),
            ])
            expect(mine.name).toBe('Kept Name')
            expect(theirs.name).toBe('Victim Name')
        })

        it('answers with the name only', async () => {
            const user = await newUser('name-shape')
            const res = await user.call('patch', '/name', { name: 'Short Name' })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ name: 'Short Name' })
        })
    })

    describe('PATCH /setting/notifications', () => {
        it('a user id in the body is refused and the other user keeps their values', async () => {
            const user = await newUser('notify-strict')
            const other = await newUser('notify-victim')
            const res = await user.call('patch', '/notifications', {
                notifyLevel: 'NONE',
                userId: other.userId,
            })
            expect(res.status).toBe(400)
            const theirs = await prisma.user.findUniqueOrThrow({ where: { id: other.userId } })
            expect(theirs.notifyLevel).toBe('IMPORTANT')
        })

        it('answers with the notification fields only', async () => {
            const user = await newUser('notify-shape')
            const res = await user.call('patch', '/notifications', { notifyLevel: 'ALL' })
            expect(res.status).toBe(200)
            expect(Object.keys(res.body.data).sort()).toEqual([
                'notifyLevel',
                'notifyProductUpdates',
                'notifyPush',
                'notifySecurityAlerts',
                'timezone',
            ])
        })
    })

    describe('PATCH /setting/defaults', () => {
        it('answers with the two defaults only', async () => {
            const user = await newUser('defaults-shape')
            const res = await user.call('patch', '/defaults', { defaultPlanFirst: true })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ defaultPlanFirst: true, defaultOpenPullRequest: true })
        })

        it('refuses a body that is not an object', async () => {
            const user = await newUser('defaults-array')
            for (const body of [[], [{ defaultPlanFirst: true }]]) {
                expect((await user.call('patch', '/defaults', body)).status).toBe(400)
            }
        })
    })

    describe('GET and PUT /setting/permissions', () => {
        it('refuses unknown keys, a string, other types and a long rule, and keeps the list', async () => {
            const user = await newUser('perm-strict')
            expect((await user.call('put', '/permissions', { rules: ['git push*'] })).status).toBe(
                200
            )
            for (const body of [
                {},
                { rules: 'rm -rf*' },
                { rules: [42] },
                { rules: [{ rule: 'x' }] },
                { rules: ['x'.repeat(301)] },
                { rules: ['ok'], userId: 'someone' },
                [],
            ]) {
                const res = await user.call('put', '/permissions', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
            expect((await user.call('get', '/permissions')).body.data).toEqual({
                rules: ['git push*'],
            })
        })

        it('takes 100 rules of 300 characters, and an empty list clears them', async () => {
            const user = await newUser('perm-bounds')
            const many = Array.from({ length: 100 }, (_, i) => `${i}-`.padEnd(300, 'x'))
            const saved = await user.call('put', '/permissions', { rules: many })
            expect(saved.status).toBe(200)
            expect(saved.body.data.rules).toHaveLength(100)

            const cleared = await user.call('put', '/permissions', { rules: [] })
            expect(cleared.body.data).toEqual({ rules: [] })
        })

        it('each user reads and changes only their own rules', async () => {
            const one = await newUser('perm-one')
            const two = await newUser('perm-two')
            await one.call('put', '/permissions', { rules: ['web_fetch'] })
            await two.call('put', '/permissions', { rules: ['git push*'] })
            expect((await one.call('get', '/permissions')).body.data).toEqual({
                rules: ['web_fetch'],
            })
            expect((await two.call('get', '/permissions')).body.data).toEqual({
                rules: ['git push*'],
            })
        })
    })

    describe('PATCH /setting/preferences', () => {
        it("changes only the signed-in user's preferences", async () => {
            const one = await newUser('pref-one')
            const two = await newUser('pref-two')
            await one.call('patch', '/preferences', { sendKey: 'mod-enter' })
            const theirs = await prisma.user.findUniqueOrThrow({ where: { id: two.userId } })
            expect(theirs.preferences).toBeNull()
        })
    })

    describe('GET and PATCH /setting/pull-requests', () => {
        it('each user reads and changes only their own settings', async () => {
            const one = await newUser('pr-one')
            const two = await newUser('pr-two')
            const saved = await one.call('patch', '/pull-requests', { branchPrefix: 'one/' })
            expect(saved.status).toBe(200)
            expect(saved.body.data.branchPrefix).toBe('one/')
            expect((await two.call('get', '/pull-requests')).body.data.branchPrefix).toBe(
                'december/'
            )
        })

        it('answers with the settings only, no row id or user id', async () => {
            const user = await newUser('pr-shape')
            await user.call('patch', '/pull-requests', { prDraft: true })
            const res = await user.call('get', '/pull-requests')
            expect(res.body.data).not.toHaveProperty('id')
            expect(res.body.data).not.toHaveProperty('userId')
            expect(res.body.data.prDraft).toBe(true)
        })
    })

    describe('GET, PATCH /setting/onboarding and POST /setting/onboarding/complete', () => {
        it('refuses unknown keys, other types and an empty body, and keeps the step', async () => {
            const user = await newUser('onb-strict')
            expect((await user.call('patch', '/onboarding', { step: 'github' })).status).toBe(200)
            for (const body of [
                {},
                { step: 'start', completedAt: '2020-01-01' },
                { step: 'start', userId: 'someone' },
                { step: 1 },
                { step: ['start'] },
                { step: 'START' },
            ]) {
                const res = await user.call('patch', '/onboarding', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
            expect((await user.call('get', '/onboarding')).body.data.step).toBe('github')
        })

        it('one user saving a step or finishing does not touch another user', async () => {
            const one = await newUser('onb-one')
            const two = await newUser('onb-two')
            await one.call('patch', '/onboarding', { step: 'models' })
            await one.call('post', '/onboarding/complete')
            const theirs = (await two.call('get', '/onboarding')).body.data
            expect(theirs.step).toBeNull()
            expect(theirs.completedAt).toBeNull()
        })

        it('complete takes no date from the body, and the profile shows it at once', async () => {
            const user = await newUser('onb-complete')
            // read the profile first, so it is cached
            expect((await user.call('get', '/')).body.data.onboardingCompletedAt).toBeNull()
            const before = Date.now()
            const res = await user.call('post', '/onboarding/complete', {
                completedAt: '2000-01-01T00:00:00.000Z',
            })
            expect(res.status).toBe(200)
            expect(new Date(res.body.data.completedAt).getTime()).toBeGreaterThanOrEqual(
                before - 5000
            )
            expect((await user.call('get', '/')).body.data.onboardingCompletedAt).not.toBeNull()
        })

        it('shows only the hint of a saved key and the gitlab name, never the key or tokens', async () => {
            const user = await newUser('onb-keys')
            await prisma.providerCredential.create({
                data: {
                    userId: user.userId,
                    provider: 'anthropic',
                    encryptedKey: 'enc-key-material-xyz',
                    keyHint: 'sk-…wxyz',
                    models: [],
                    defaultModel: 'claude-x',
                    verifiedAt: new Date(),
                },
            })
            await prisma.gitConnection.create({
                data: {
                    userId: user.userId,
                    provider: 'GITLAB',
                    externalId: `ext-${stamp}`,
                    username: 'lab-user',
                    encryptedAccessToken: 'enc-access-token-xyz',
                    encryptedRefreshToken: 'enc-refresh-token-xyz',
                },
            })

            const res = await user.call('get', '/onboarding')
            expect(res.status).toBe(200)
            expect(res.body.data.ownKey).toEqual({ provider: 'anthropic', keyHint: 'sk-…wxyz' })
            expect(res.body.data.gitlab).toEqual({ username: 'lab-user' })
            expect(res.body.data.steps).toEqual({ models: true, github: true })
            const raw = JSON.stringify(res.body.data)
            for (const word of [
                ...SECRET_WORDS,
                'enc-key-material-xyz',
                'enc-access-token-xyz',
                'enc-refresh-token-xyz',
            ]) {
                expect({ word, found: raw.includes(word) }).toEqual({ word, found: false })
            }

            // another user does not see this key or this gitlab account
            const other = await newUser('onb-keys-other')
            const theirs = (await other.call('get', '/onboarding')).body.data
            expect(theirs.ownKey).toBeNull()
            expect(theirs.gitlab).toBeNull()
        })
    })

    describe('POST /setting/feedback', () => {
        it('refuses unknown keys and a missing rating, and saves nothing', async () => {
            const user = await newUser('fb-strict')
            const other = await newUser('fb-victim')
            for (const body of [
                { rating: null, feedback: 'hi', userId: other.userId },
                { feedback: 'hi' },
                { rating: 'happy', feedback: ['hi'] },
            ]) {
                const res = await user.call('post', '/feedback', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
            expect(
                await prisma.feedback.count({
                    where: { userId: { in: [user.userId, other.userId] } },
                })
            ).toBe(0)
        })

        it('saves on the signed-in user and answers with the id only', async () => {
            const user = await newUser('fb-save')
            const res = await user.call('post', '/feedback', { rating: 'neutral', feedback: 'ok' })
            expect(res.status).toBe(200)
            expect(Object.keys(res.body.data)).toEqual(['id'])
            const row = await prisma.feedback.findUniqueOrThrow({ where: { id: res.body.data.id } })
            expect(row).toMatchObject({ userId: user.userId, rating: 'neutral', feedback: 'ok' })
        })

        it('takes at most 10 in an hour from one user, and others are not limited', async () => {
            const user = await newUser('fb-limit')
            for (let i = 0; i < 10; i++) {
                const res = await user.call('post', '/feedback', {
                    rating: null,
                    feedback: `note ${i}`,
                })
                expect(res.status).toBe(200)
            }
            const limited = await user.call('post', '/feedback', {
                rating: null,
                feedback: 'one more',
            })
            expect(limited.status).toBe(429)
            expect(await prisma.feedback.count({ where: { userId: user.userId } })).toBe(10)

            const other = await newUser('fb-limit-other')
            expect(
                (await other.call('post', '/feedback', { rating: null, feedback: 'mine' })).status
            ).toBe(200)
        })
    })
})
