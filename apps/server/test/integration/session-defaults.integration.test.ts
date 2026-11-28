import { prisma } from '@december/database'
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'qwen-qwq-32b']

const FRESH_DEFAULTS = {
    defaultModelSource: 'CREDITS' as const,
    defaultPlanFirst: false,
    defaultOpenPullRequest: true,
}

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
})

const addGroqKey = (userId: string) =>
    prisma.providerCredential.create({
        data: {
            userId,
            provider: 'groq',
            encryptedKey: 'encrypted',
            keyHint: '1234',
            models: GROQ_MODELS,
            defaultModel: GROQ_MODELS[0]!,
            verifiedAt: new Date(),
        },
    })

// the defaults that are left after the Defaults page was removed: "save as default" in the
// prompt box (PATCH /setting/defaults: plan first and open pull request) and the model source
// on the API keys page (PATCH /setting/model-source)
describe('session defaults and model source api', () => {
    const stamp = Date.now()
    const userIds: string[] = []
    let user: { userId: string; token: string }
    let other: { userId: string; token: string }
    let counter = 0

    const newUser = async () => {
        counter += 1
        const created = await createSignedInUser({
            email: `defaults-page-${counter}-${stamp}@example.com`,
        })
        userIds.push(created.userId)
        return created
    }

    beforeEach(async () => {
        user = await newUser()
        other = await newUser()
    })

    afterAll(async () => {
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    const profileOf = async (token: string) => (await authed(token).get('/setting')).body.data

    it('a new account starts on december credits, no plan first, and a pull request', async () => {
        const profile = await profileOf(user.token)
        for (const [key, value] of Object.entries(FRESH_DEFAULTS)) {
            expect({ key, value: profile[key] }).toEqual({ key, value })
        }
    })

    it('the profile no longer has the removed defaults', async () => {
        const profile = await profileOf(user.token)
        for (const key of [
            'defaultEffort',
            'defaultOwnKeyProvider',
            'defaultOwnKeyModel',
            'defaultRepository',
            'defaultBaseBranch',
        ]) {
            expect(profile).not.toHaveProperty(key)
        }
    })

    it('the branch check of the old default base branch is gone', async () => {
        const res = await authed(user.token).get(
            '/platform/repos/branch?repository=acme/web&branch=main'
        )
        expect(res.status).toBe(404)
    })

    it('both endpoints need a sign-in', async () => {
        for (const path of ['/setting/defaults', '/setting/model-source']) {
            const res = await request(app)
                .patch(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .send({ defaultPlanFirst: true, defaultModelSource: 'CREDITS' })
            expect({ path, status: res.status }).toEqual({ path, status: 401 })
        }
    })

    describe('PATCH /setting/defaults', () => {
        it('saves plan first and open pull request alone or together, and GET /setting shows it', async () => {
            // fill the profile cache first, so a stale cache would show
            await profileOf(user.token)

            let res = await authed(user.token).patch('/setting/defaults', {
                defaultPlanFirst: true,
            })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ defaultPlanFirst: true, defaultOpenPullRequest: true })
            let profile = await profileOf(user.token)
            expect(profile.defaultPlanFirst).toBe(true)
            expect(profile.defaultOpenPullRequest).toBe(true)

            res = await authed(user.token).patch('/setting/defaults', {
                defaultOpenPullRequest: false,
            })
            expect(res.body.data).toEqual({ defaultPlanFirst: true, defaultOpenPullRequest: false })

            res = await authed(user.token).patch('/setting/defaults', {
                defaultPlanFirst: false,
                defaultOpenPullRequest: true,
            })
            expect(res.status).toBe(200)
            profile = await profileOf(user.token)
            expect(profile.defaultPlanFirst).toBe(false)
            expect(profile.defaultOpenPullRequest).toBe(true)
        })

        it('the pull requests page no longer has its own copy of open pull request', async () => {
            await authed(user.token).patch('/setting/defaults', { defaultOpenPullRequest: false })
            const pr = await authed(user.token).get('/setting/pull-requests')
            expect(pr.status).toBe(200)
            expect(pr.body.data).not.toHaveProperty('prCreate')
        })

        it('a new session takes the saved values', async () => {
            await prisma.user.update({
                where: { id: user.userId },
                data: { creditBalance: 10_000 },
            })
            await authed(user.token).patch('/setting/defaults', {
                defaultPlanFirst: true,
                defaultOpenPullRequest: false,
            })
            const res = await request(app)
                .post('/api/v1/session')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${user.token}`)
                .send({ prompt: 'x' })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config).toEqual({
                planFirst: true,
                effort: 'fast',
                openPullRequest: false,
            })
        })

        it('refuses bad values, the removed fields and unknown fields, and saves nothing', async () => {
            const bad: unknown[] = [
                {},
                { defaultPlanFirst: 'yes' },
                { defaultPlanFirst: null },
                { defaultPlanFirst: 1 },
                { defaultOpenPullRequest: 'no' },
                // the removed defaults
                { defaultEffort: 'fast' },
                { defaultRepository: 'acme/web' },
                { defaultBaseBranch: 'develop' },
                { defaultOwnKeyProvider: 'groq', defaultOwnKeyModel: GROQ_MODELS[0] },
                // a real field next to one the endpoint does not have
                { defaultPlanFirst: true, defaultEffort: 'deep' },
                { defaultPlanFirst: true, creditBalance: 1_000_000 },
                { defaultPlanFirst: true, isDeleted: true },
                { defaultModelSource: 'OWN_KEY' },
            ]
            for (const body of bad) {
                const res = await authed(user.token).patch('/setting/defaults', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
            const saved = await prisma.user.findUnique({ where: { id: user.userId } })
            expect(saved?.defaultPlanFirst).toBe(false)
            expect(saved?.defaultOpenPullRequest).toBe(true)
            expect(saved?.defaultModelSource).toBe('CREDITS')
            expect(saved?.creditBalance).toBe(0)
            expect(saved?.isDeleted).toBe(false)
        })

        it("changes only the signed-in user's defaults", async () => {
            await authed(user.token).patch('/setting/defaults', {
                defaultPlanFirst: true,
                defaultOpenPullRequest: false,
            })
            const profile = await profileOf(other.token)
            expect(profile.defaultPlanFirst).toBe(false)
            expect(profile.defaultOpenPullRequest).toBe(true)
        })
    })

    describe('PATCH /setting/model-source', () => {
        it('switches to your keys only when a key is saved', async () => {
            let res = await authed(user.token).patch('/setting/model-source', {
                defaultModelSource: 'OWN_KEY',
            })
            expect(res.status).toBe(400)
            expect((await profileOf(user.token)).defaultModelSource).toBe('CREDITS')

            await addGroqKey(user.userId)
            res = await authed(user.token).patch('/setting/model-source', {
                defaultModelSource: 'OWN_KEY',
            })
            expect(res.status).toBe(200)
            expect(res.body.data.defaultModelSource).toBe('OWN_KEY')
            expect((await profileOf(user.token)).defaultModelSource).toBe('OWN_KEY')
        })

        it('switches back to credits at any time', async () => {
            await addGroqKey(user.userId)
            await authed(user.token).patch('/setting/model-source', {
                defaultModelSource: 'OWN_KEY',
            })
            const res = await authed(user.token).patch('/setting/model-source', {
                defaultModelSource: 'CREDITS',
            })
            expect(res.status).toBe(200)
            expect((await profileOf(user.token)).defaultModelSource).toBe('CREDITS')
        })

        it("another user's key does not count", async () => {
            await addGroqKey(other.userId)
            const res = await authed(user.token).patch('/setting/model-source', {
                defaultModelSource: 'OWN_KEY',
            })
            expect(res.status).toBe(400)
        })

        it('refuses a bad source', async () => {
            for (const body of [
                {},
                { defaultModelSource: 'own_key' },
                { defaultModelSource: 'FREE' },
                { defaultModelSource: null },
                { defaultModelSource: 1 },
            ]) {
                const res = await authed(user.token).patch('/setting/model-source', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }
        })
    })
})
