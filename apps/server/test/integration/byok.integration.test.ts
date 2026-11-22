import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { byokUtils } from '../../src/modules/byok/byok.utils'
import { cleanupTestUser, getRandomIP } from '../helpers'

const createUserWithToken = async (label: string) => {
    const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
    const user = await prisma.user.create({
        data: {
            name: `BYOK ${label}`,
            email: `byok-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
            emailVerified: true,
            creditBalance: 0,
        },
    })
    const session = await prisma.authSession.create({
        data: {
            userId: user.id,
            refreshTokenHash: `byok-hash-${user.id}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    })
    return {
        userId: user.id,
        token: generateAccessToken({ userId: user.id, sessionId: session.id }),
    }
}

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'qwen-qwq-32b']

describe('BYOK (own keys) API', () => {
    const userIds: string[] = []
    const originalVerify = byokUtils.verifyKey
    let main: { userId: string; token: string }

    beforeAll(async () => {
        // no network in tests: a key containing "bad" fails, anything else passes
        byokUtils.verifyKey = (async ({ apiKey }: { apiKey: string }) =>
            apiKey.includes('bad')
                ? { ok: false, reason: 'bad_key' }
                : { ok: true, models: GROQ_MODELS, defaultModel: GROQ_MODELS[0] }) as any
        main = await createUserWithToken('main')
        userIds.push(main.userId)
    })

    afterAll(async () => {
        byokUtils.verifyKey = originalVerify
        for (const id of userIds) {
            await prisma.providerCredential.deleteMany({ where: { userId: id } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await prisma.session.deleteMany({ where: { userId: id } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await cleanupTestUser({ id })
        }
    })

    const api = (token: string) => ({
        list: () =>
            request(app)
                .get('/api/v1/byok')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        save: (provider: string, apiKey: string) =>
            request(app)
                .put(`/api/v1/byok/${provider}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send({ apiKey }),
        remove: (provider: string) =>
            request(app)
                .delete(`/api/v1/byok/${provider}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
    })

    it('requires sign-in', async () => {
        const res = await request(app).get('/api/v1/byok').set('x-forwarded-for', getRandomIP())
        expect(res.status).toBe(401)
    })

    it('lists the 42 providers and no saved keys for a new user', async () => {
        const res = await api(main.token).list()
        expect(res.status).toBe(200)
        expect(res.body.data.providers).toHaveLength(42)
        expect(res.body.data.credentials).toEqual([])
    })

    it('saves a key encrypted and never returns it', async () => {
        const res = await api(main.token).save('groq', 'gsk_integration_secret_9999')
        expect(res.status).toBe(200)
        expect(res.body.data.credential).toMatchObject({
            provider: 'groq',
            keyHint: '9999',
            models: GROQ_MODELS,
            defaultModel: GROQ_MODELS[0],
        })
        expect(JSON.stringify(res.body)).not.toContain('gsk_integration_secret_9999')

        const row = await prisma.providerCredential.findUnique({
            where: { userId_provider: { userId: main.userId, provider: 'groq' } },
        })
        expect(row?.encryptedKey).toBeDefined()
        expect(row?.encryptedKey).not.toContain('gsk_integration_secret_9999')

        const list = await api(main.token).list()
        expect(list.body.data.credentials).toHaveLength(1)
        expect(JSON.stringify(list.body)).not.toContain('gsk_integration_secret_9999')
        expect(JSON.stringify(list.body)).not.toContain(row!.encryptedKey)
    })

    it('rejects a key that fails the check and an unknown provider', async () => {
        const bad = await api(main.token).save('openai', 'sk-bad-key')
        expect(bad.status).toBe(400)
        expect(
            await prisma.providerCredential.count({
                where: { userId: main.userId, provider: 'openai' },
            })
        ).toBe(0)

        const unknown = await api(main.token).save('claude', 'sk-whatever')
        expect(unknown.status).toBe(400)
    })

    it('starts an own-key session with a $0 balance, but not a credits session', async () => {
        const credits = await request(app)
            .post('/api/v1/session')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${main.token}`)
            .send({ prompt: 'build a todo app' })
        expect(credits.status).toBe(402)

        const ownKey = await request(app)
            .post('/api/v1/session')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${main.token}`)
            .send({
                prompt: 'build a todo app',
                billingSource: 'OWN_KEY',
                provider: 'groq',
                model: GROQ_MODELS[0],
            })
        expect(ownKey.status).toBe(201)

        const wrongModel = await request(app)
            .post('/api/v1/session')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${main.token}`)
            .send({
                prompt: 'build a todo app',
                billingSource: 'OWN_KEY',
                provider: 'groq',
                model: 'gpt-5',
            })
        expect(wrongModel.status).toBe(400)

        const noKey = await request(app)
            .post('/api/v1/session')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${main.token}`)
            .send({ prompt: 'x', billingSource: 'OWN_KEY', provider: 'openai', model: 'gpt-5' })
        expect(noKey.status).toBe(400)
    })

    it('updates the default model source', async () => {
        const res = await request(app)
            .patch('/api/v1/setting/model-source')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${main.token}`)
            .send({ defaultModelSource: 'OWN_KEY' })
        expect(res.status).toBe(200)
        expect(res.body.data.defaultModelSource).toBe('OWN_KEY')

        const invalid = await request(app)
            .patch('/api/v1/setting/model-source')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${main.token}`)
            .send({ defaultModelSource: 'FREE' })
        expect(invalid.status).toBe(400)
    })

    it('leaves own-key usage out of the credits used totals', async () => {
        const spender = await createUserWithToken('usage')
        userIds.push(spender.userId)
        const now = new Date()
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        const event = (billingSource: 'CREDITS' | 'OWN_KEY', costInCents: number) => ({
            userId: spender.userId,
            model: 'test-model',
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            costInCents,
            billingSource,
            periodStart,
            periodEnd,
        })
        await prisma.usageEvent.createMany({
            data: [event('CREDITS', 12), event('OWN_KEY', 300)],
        })

        const usage = await request(app)
            .get('/api/v1/usage')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${spender.token}`)
        expect(usage.status).toBe(200)
        expect(JSON.stringify(usage.body)).toContain('"usedInCents":12')

        const overview = await request(app)
            .get('/api/v1/billing/overview')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${spender.token}`)
        expect(overview.status).toBe(200)
        expect(JSON.stringify(overview.body)).toContain('"costInCents":12')

        const history = await request(app)
            .get('/api/v1/billing/credits/history')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${spender.token}`)
        expect(history.status).toBe(200)
        expect(history.body.data.events).toHaveLength(2)
        const periodTotal = history.body.data.periods.reduce(
            (sum: number, p: { costInCents: number }) => sum + p.costInCents,
            0
        )
        expect(periodTotal).toBe(12)

        await prisma.usageEvent.deleteMany({ where: { userId: spender.userId } })
    })

    it('deletes a key', async () => {
        const res = await api(main.token).remove('groq')
        expect(res.status).toBe(200)
        const again = await api(main.token).remove('groq')
        expect(again.status).toBe(404)
    })

    it('limits key checks to 10 per 15 minutes per user', async () => {
        const limited = await createUserWithToken('ratelimit')
        userIds.push(limited.userId)
        const statuses: number[] = []
        for (let i = 0; i < 11; i++) {
            statuses.push((await api(limited.token).save('groq', `gsk_rate_${i}_abcd`)).status)
        }
        expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true)
        expect(statuses[10]).toBe(429)
    })

    it('removes saved keys when the account is deleted', async () => {
        const leaving = await createUserWithToken('leaving')
        userIds.push(leaving.userId)
        expect((await api(leaving.token).save('groq', 'gsk_leaving_1111')).status).toBe(200)

        const res = await request(app)
            .delete('/api/v1/auth/account')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${leaving.token}`)
        expect(res.status).toBe(200)
        expect(await prisma.providerCredential.count({ where: { userId: leaving.userId } })).toBe(0)
    })
})
