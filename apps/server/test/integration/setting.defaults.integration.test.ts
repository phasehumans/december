import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { byokUtils } from '../../src/modules/byok/byok.utils'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'qwen-qwq-32b']

// issue 637 section 1: the rest of the defaults for a new session (the model of the user's
// own key, the repository, the base branch) and the own-key model of POST /session
describe('Defaults for new sessions (#637)', () => {
    const email = `defaults637-${Date.now()}@example.com`
    const originalVerify = byokUtils.verifyKey
    let userId: string
    let token: string

    const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string) =>
        request(app)
            [method](`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)

    const savedConfig = async (sessionId: string) =>
        (await prisma.sessionSettings.findUnique({ where: { sessionId } }))?.config as Record<
            string,
            unknown
        >

    beforeAll(async () => {
        // no network in tests: every key passes and serves the two groq models
        byokUtils.verifyKey = (async () => ({
            ok: true,
            models: GROQ_MODELS,
            defaultModel: GROQ_MODELS[0],
        })) as any

        const user = await prisma.user.create({
            data: { email, name: 'Defaults User', emailVerified: true, creditBalance: 10_000 },
        })
        userId = user.id
        token = authCookieToken(await signInWithEmailCode(app, email))
    })

    beforeEach(async () => {
        await prisma.session.deleteMany({ where: { userId } })
        await prisma.providerCredential.deleteMany({ where: { userId } })
        await prisma.user.update({
            where: { id: userId },
            data: {
                defaultPlanFirst: false,
                defaultEffort: 'deep',
                defaultOpenPullRequest: true,
                defaultOwnKeyProvider: null,
                defaultOwnKeyModel: null,
                defaultRepository: 'last-used',
                defaultBaseBranch: 'default',
            },
        })
    })

    afterAll(async () => {
        byokUtils.verifyKey = originalVerify
        await prisma.session.deleteMany({ where: { userId } }).catch(() => {
            // Intentionally swallowed: test cleanup fallback
        })
        await prisma.providerCredential.deleteMany({ where: { userId } }).catch(() => {
            // Intentionally swallowed: test cleanup fallback
        })
        await cleanupTestUser({ id: userId })
    })

    describe('PATCH /setting/defaults', () => {
        it('starts on last used, the default branch and no own-key model', async () => {
            const profile = await call('get', '/setting')
            expect(profile.status).toBe(200)
            expect(profile.body.data).toMatchObject({
                defaultOwnKeyProvider: null,
                defaultOwnKeyModel: null,
                defaultRepository: 'last-used',
                defaultBaseBranch: 'default',
            })
        })

        it('saves the repository and the base branch, and the profile returns them', async () => {
            const saved = await call('patch', '/setting/defaults').send({
                defaultRepository: 'acme/web',
                defaultBaseBranch: ' develop ',
            })
            expect(saved.status).toBe(200)
            expect(saved.body.data).toEqual({
                defaultPlanFirst: false,
                defaultEffort: 'deep',
                defaultOpenPullRequest: true,
                defaultOwnKeyProvider: null,
                defaultOwnKeyModel: null,
                defaultRepository: 'acme/web',
                defaultBaseBranch: 'develop',
            })

            const profile = await call('get', '/setting')
            expect(profile.body.data.defaultRepository).toBe('acme/web')
            expect(profile.body.data.defaultBaseBranch).toBe('develop')
        })

        it('keeps a field the request leaves out', async () => {
            await call('patch', '/setting/defaults').send({
                defaultRepository: 'acme/web',
                defaultBaseBranch: 'develop',
                defaultEffort: 'fast',
            })

            const saved = await call('patch', '/setting/defaults').send({ defaultPlanFirst: true })
            expect(saved.status).toBe(200)
            expect(saved.body.data).toEqual({
                defaultPlanFirst: true,
                defaultEffort: 'fast',
                defaultOpenPullRequest: true,
                defaultOwnKeyProvider: null,
                defaultOwnKeyModel: null,
                defaultRepository: 'acme/web',
                defaultBaseBranch: 'develop',
            })

            const back = await call('patch', '/setting/defaults').send({
                defaultRepository: 'last-used',
            })
            expect(back.body.data.defaultRepository).toBe('last-used')
            expect(back.body.data.defaultBaseBranch).toBe('develop')
        })

        it('rejects bad values and saves nothing', async () => {
            const bad = [
                { defaultRepository: 'web' },
                { defaultRepository: 'acme/web app' },
                { defaultRepository: `acme/${'a'.repeat(200)}` },
                { defaultBaseBranch: '' },
                { defaultBaseBranch: 'feature branch' },
                { defaultBaseBranch: 'a'.repeat(101) },
                { defaultOwnKeyProvider: 'groq' },
                { defaultOwnKeyModel: GROQ_MODELS[1] },
                { defaultOwnKeyProvider: 'groq', defaultOwnKeyModel: null },
                { defaultOwnKeyProvider: 'g'.repeat(65), defaultOwnKeyModel: GROQ_MODELS[1] },
            ]
            for (const body of bad) {
                const res = await call('patch', '/setting/defaults').send(body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
            }

            const profile = await call('get', '/setting')
            expect(profile.body.data).toMatchObject({
                defaultOwnKeyProvider: null,
                defaultOwnKeyModel: null,
                defaultRepository: 'last-used',
                defaultBaseBranch: 'default',
            })
        })

        it('saves an own-key model only for a key the user has', async () => {
            const noKey = await call('patch', '/setting/defaults').send({
                defaultOwnKeyProvider: 'groq',
                defaultOwnKeyModel: GROQ_MODELS[1],
            })
            expect(noKey.status).toBe(400)

            const key = await call('put', '/byok/groq').send({ apiKey: 'gsk_defaults_key_1234' })
            expect(key.status).toBe(200)

            const wrongModel = await call('patch', '/setting/defaults').send({
                defaultOwnKeyProvider: 'groq',
                defaultOwnKeyModel: 'gpt-5',
            })
            expect(wrongModel.status).toBe(400)

            const saved = await call('patch', '/setting/defaults').send({
                defaultOwnKeyProvider: 'groq',
                defaultOwnKeyModel: GROQ_MODELS[1],
            })
            expect(saved.status).toBe(200)
            expect(saved.body.data.defaultOwnKeyProvider).toBe('groq')
            expect(saved.body.data.defaultOwnKeyModel).toBe('qwen-qwq-32b')

            const profile = await call('get', '/setting')
            expect(profile.body.data.defaultOwnKeyProvider).toBe('groq')
            expect(profile.body.data.defaultOwnKeyModel).toBe('qwen-qwq-32b')

            const cleared = await call('patch', '/setting/defaults').send({
                defaultOwnKeyProvider: null,
                defaultOwnKeyModel: null,
            })
            expect(cleared.status).toBe(200)
            expect(cleared.body.data.defaultOwnKeyProvider).toBeNull()
            expect(cleared.body.data.defaultOwnKeyModel).toBeNull()
        })
    })

    describe('POST /session on an own key', () => {
        const startOwnKey = (body: object = {}) =>
            call('post', '/session').send({ prompt: 'x', billingSource: 'OWN_KEY', ...body })

        it('uses the default own-key model when the request names no model', async () => {
            await call('put', '/byok/groq').send({ apiKey: 'gsk_defaults_key_1234' })
            await call('patch', '/setting/defaults').send({
                defaultOwnKeyProvider: 'groq',
                defaultOwnKeyModel: GROQ_MODELS[1],
            })

            // no provider and no model: both come from the default
            const bare = await startOwnKey()
            expect(bare.status).toBe(201)
            expect(bare.body.data.session.config).toEqual({
                planFirst: false,
                effort: 'deep',
                openPullRequest: true,
                provider: 'groq',
                model: 'qwen-qwq-32b',
            })
            expect(await savedConfig(bare.body.data.session.id)).toMatchObject({
                provider: 'groq',
                model: 'qwen-qwq-32b',
            })

            // the provider of the default, no model
            const sameProvider = await startOwnKey({ provider: 'groq' })
            expect(sameProvider.status).toBe(201)
            expect(sameProvider.body.data.session.config.model).toBe('qwen-qwq-32b')
        })

        it('keeps the model the request names', async () => {
            await call('put', '/byok/groq').send({ apiKey: 'gsk_defaults_key_1234' })
            await call('patch', '/setting/defaults').send({
                defaultOwnKeyProvider: 'groq',
                defaultOwnKeyModel: GROQ_MODELS[1],
            })

            const res = await startOwnKey({ provider: 'groq', model: GROQ_MODELS[0] })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config.model).toBe('llama-3.3-70b-versatile')
            expect(res.body.data.session.config.provider).toBe('groq')
        })

        it('works as before when the key of the default is gone', async () => {
            await call('put', '/byok/groq').send({ apiKey: 'gsk_defaults_key_1234' })
            await call('put', '/byok/openai').send({ apiKey: 'sk_defaults_key_5678' })
            await call('patch', '/setting/defaults').send({
                defaultOwnKeyProvider: 'groq',
                defaultOwnKeyModel: GROQ_MODELS[1],
            })
            const removed = await call('delete', '/byok/groq')
            expect(removed.status).toBe(200)

            // no provider: the request must name one, as before
            const bare = await startOwnKey()
            expect(bare.status).toBe(400)

            // another provider: no model is saved for the session, as before
            const other = await startOwnKey({ provider: 'openai' })
            expect(other.status).toBe(201)
            expect(other.body.data.session.config).toEqual({
                planFirst: false,
                effort: 'deep',
                openPullRequest: true,
            })
        })

        it('starts a session with no repository when the default names one', async () => {
            await call('patch', '/setting/defaults').send({
                defaultRepository: 'acme/web',
                defaultBaseBranch: 'develop',
            })

            const res = await call('post', '/session').send({ prompt: 'x' })
            expect(res.status).toBe(201)
            const row = await prisma.session.findUnique({
                where: { id: res.body.data.session.id },
            })
            expect(row?.repoUrl).toBeNull()
            expect(row?.githubRepoName).toBeNull()
            expect(row?.branch).toBeNull()
        })
    })
})
