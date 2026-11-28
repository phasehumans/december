import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { byokUtils } from '../../src/modules/byok/byok.utils'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'qwen-qwq-32b']

// the Defaults page is removed: a new session starts on fast, december credits, no
// repository, and on an own key the key's default model. values saved on the old page stay
// in the database and are ignored
describe('new session start values', () => {
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
            data: { defaultPlanFirst: false, defaultOpenPullRequest: true },
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

    describe('POST /session on an own key', () => {
        const startOwnKey = (body: object = {}) =>
            call('post', '/session').send({ prompt: 'x', billingSource: 'OWN_KEY', ...body })

        it('needs a provider with a saved key', async () => {
            expect((await startOwnKey()).status).toBe(400)
            expect((await startOwnKey({ provider: 'groq' })).status).toBe(400)
        })

        it('with no model saves none, so the run uses the key default', async () => {
            await call('put', '/byok/groq').send({ apiKey: 'gsk_defaults_key_1234' })

            const res = await startOwnKey({ provider: 'groq' })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config).toEqual({
                planFirst: false,
                effort: 'fast',
                openPullRequest: true,
            })
        })

        it('keeps the model the request names', async () => {
            await call('put', '/byok/groq').send({ apiKey: 'gsk_defaults_key_1234' })

            const res = await startOwnKey({ provider: 'groq', model: GROQ_MODELS[1] })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config).toMatchObject({
                provider: 'groq',
                model: 'qwen-qwq-32b',
            })
            expect(await savedConfig(res.body.data.session.id)).toMatchObject({
                provider: 'groq',
                model: 'qwen-qwq-32b',
            })
        })

        it('refuses a model the key does not serve', async () => {
            await call('put', '/byok/groq').send({ apiKey: 'gsk_defaults_key_1234' })
            const res = await startOwnKey({ provider: 'groq', model: 'gpt-5' })
            expect(res.status).toBe(400)
        })
    })

    describe('POST /session on december credits', () => {
        it('starts on fast with no repository', async () => {
            const res = await call('post', '/session').send({ prompt: 'x' })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config.effort).toBe('fast')
            const row = await prisma.session.findUnique({
                where: { id: res.body.data.session.id },
            })
            expect(row?.repoUrl).toBeNull()
            expect(row?.githubRepoName).toBeNull()
            expect(row?.branch).toBeNull()
        })

        it('deep when the prompt box sends it', async () => {
            const res = await call('post', '/session').send({ prompt: 'x', tier: 'deep' })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config.effort).toBe('deep')
        })
    })
})
