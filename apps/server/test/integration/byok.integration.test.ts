import { prisma } from '@december/database'
import { decryptText, encryptText } from '@december/shared/crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { byokRepository } from '../../src/modules/byok/byok.repository'
import { byokUtils } from '../../src/modules/byok/byok.utils'
import { githubAppRepository } from '../../src/modules/githubapp/githubapp.repository'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'qwen-qwq-32b']

type Verify = (data: { provider: string; apiKey: string }) => Promise<any>

// no network in tests. a key with "bad" fails, "echo" fails with a message that repeats the
// key, "boom" throws, anything else passes. a test can put its own check in `nextVerify`
const defaultVerify: Verify = async ({ apiKey }) => {
    if (apiKey.includes('bad')) return { ok: false, reason: 'bad_key' }
    if (apiKey.includes('echo')) {
        return { ok: false, reason: 'bad_key', message: `Invalid API Key: ${apiKey}` }
    }
    if (apiKey.includes('boom')) throw new Error(`socket closed while sending ${apiKey}`)
    return { ok: true, models: GROQ_MODELS, defaultModel: GROQ_MODELS[0] }
}
let nextVerify: Verify | null = null

describe('BYOK (own keys) API', () => {
    const userIds: string[] = []
    const originalVerify = byokUtils.verifyKey
    let counter = 0
    const stamp = Date.now()
    let user: { userId: string; token: string }

    const newUser = async () => {
        counter += 1
        const created = await createSignedInUser({
            email: `byok-${counter}-${stamp}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        })
        userIds.push(created.userId)
        return created
    }

    beforeAll(() => {
        byokUtils.verifyKey = (async (data: { provider: string; apiKey: string }) => {
            const verify = nextVerify ?? defaultVerify
            nextVerify = null
            return verify(data)
        }) as any
    })

    // a new user for each test: the key check limit is per user
    beforeEach(async () => {
        nextVerify = null
        user = await newUser()
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

    const api = (token: string | null) => {
        const withAuth = (req: request.Test) => {
            req.set('x-forwarded-for', getRandomIP())
            return token ? req.set('Authorization', `Bearer ${token}`) : req
        }
        return {
            list: () => withAuth(request(app).get('/api/v1/byok')),
            save: (provider: string, body: unknown) =>
                withAuth(request(app).put(`/api/v1/byok/${provider}`)).send(body as object),
            refresh: (provider: string, body?: unknown) => {
                const req = withAuth(request(app).post(`/api/v1/byok/${provider}/refresh`))
                return body === undefined ? req : req.send(body as object)
            },
            remove: (provider: string) => withAuth(request(app).delete(`/api/v1/byok/${provider}`)),
        }
    }
    const saveKey = (token: string, provider: string, apiKey: string) =>
        api(token).save(provider, { apiKey })
    const rowOf = (userId: string, provider: string) =>
        prisma.providerCredential.findUnique({
            where: { userId_provider: { userId, provider } },
        })

    describe('sign-in', () => {
        it('every route needs a sign-in', async () => {
            const anon = api(null)
            const results = [
                await anon.list(),
                await anon.save('groq', { apiKey: 'gsk_anon_key_123456' }),
                await anon.refresh('groq'),
                await anon.remove('groq'),
            ]
            expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401])
        })

        it('refuses a bad token', async () => {
            const res = await api('not-a-token').list()
            expect(res.status).toBe(401)
        })
    })

    describe('GET /byok', () => {
        it('lists the 42 providers once each, and no saved keys for a new user', async () => {
            const res = await api(user.token).list()
            expect(res.status).toBe(200)
            const ids = res.body.data.providers.map((p: { id: string }) => p.id)
            expect(ids).toHaveLength(42)
            expect(new Set(ids).size).toBe(42)
            expect(res.body.data.credentials).toEqual([])
        })

        it("shows only the signed-in user's keys", async () => {
            const other = await newUser()
            await saveKey(other.token, 'groq', 'gsk_other_user_key_7777')
            const res = await api(user.token).list()
            expect(res.body.data.credentials).toEqual([])
            const theirs = await api(other.token).list()
            expect(theirs.body.data.credentials).toHaveLength(1)
        })
    })

    describe('PUT /byok/:provider', () => {
        it('saves a key encrypted at rest and never returns it', async () => {
            const key = 'gsk_integration_secret_9999'
            const res = await saveKey(user.token, 'groq', `  ${key}  `)
            expect(res.status).toBe(200)
            expect(res.body.data.credential).toMatchObject({
                provider: 'groq',
                keyHint: '9999',
                models: GROQ_MODELS,
                defaultModel: GROQ_MODELS[0],
            })
            expect(Object.keys(res.body.data.credential).sort()).toEqual(
                ['defaultModel', 'keyHint', 'lastUsedAt', 'models', 'provider', 'verifiedAt'].sort()
            )
            expect(JSON.stringify(res.body)).not.toContain(key)

            const row = await rowOf(user.userId, 'groq')
            // AES-256-GCM: iv:authTag:ciphertext, all hex, and it opens to the trimmed key
            expect(row!.encryptedKey).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/)
            expect(row!.encryptedKey).not.toContain(key)
            expect(
                decryptText({ encryptedText: row!.encryptedKey, keyHex: env.SECRETS_ENC_KEY })
            ).toBe(key)

            const list = await api(user.token).list()
            expect(list.body.data.credentials).toHaveLength(1)
            expect(JSON.stringify(list.body)).not.toContain(key)
            expect(JSON.stringify(list.body)).not.toContain(row!.encryptedKey)
        })

        it('replaces the key of a provider, keeping one row', async () => {
            await saveKey(user.token, 'groq', 'gsk_first_key_value_1111')
            const res = await saveKey(user.token, 'groq', 'gsk_second_key_value_2222')
            expect(res.status).toBe(200)
            expect(res.body.data.credential.keyHint).toBe('2222')
            expect(
                await prisma.providerCredential.count({
                    where: { userId: user.userId, provider: 'groq' },
                })
            ).toBe(1)
            const row = await rowOf(user.userId, 'groq')
            expect(
                decryptText({ encryptedText: row!.encryptedKey, keyHex: env.SECRETS_ENC_KEY })
            ).toBe('gsk_second_key_value_2222')
        })

        it('shows no hint for a short key', async () => {
            const res = await saveKey(user.token, 'groq', 'gsk_short')
            expect(res.status).toBe(200)
            expect(res.body.data.credential.keyHint).toBe('')
        })

        it('does not save a key that fails the check', async () => {
            const res = await saveKey(user.token, 'openai', 'sk-bad-key-value-0000')
            expect(res.status).toBe(400)
            expect(res.body.message).toContain('OpenAI rejected this key')
            expect(await rowOf(user.userId, 'openai')).toBeNull()
        })

        it('never repeats the key in an error message', async () => {
            const key = 'gsk_echo_secret_value_4242'
            const res = await saveKey(user.token, 'groq', key)
            expect(res.status).toBe(400)
            expect(JSON.stringify(res.body)).not.toContain(key)
            expect(res.body.message).toContain('[key]')
        })

        it('an unknown failure of the check is a plain 502 without its text', async () => {
            const key = 'gsk_boom_secret_value_4343'
            const res = await saveKey(user.token, 'groq', key)
            expect(res.status).toBe(502)
            expect(JSON.stringify(res.body)).not.toContain(key)
            expect(res.body.message).toBe(
                'December could not reach Groq to check the key. Try again.'
            )
        })

        it('refuses a claude plan token and a watsonx key without a project id', async () => {
            const plan = await saveKey(user.token, 'anthropic', 'sk-ant-oat01-plan-token-value')
            expect(plan.status).toBe(400)
            expect(plan.body.message).toContain('Claude plan token')
            const watsonx = await saveKey(user.token, 'watsonx', 'ibmapikeyvalue1234')
            expect(watsonx.status).toBe(400)
            expect(watsonx.body.message).toContain('API_KEY:PROJECT_ID')
        })

        it('keeps a clean model list from the provider', async () => {
            nextVerify = async () => ({
                ok: true,
                models: ['m1', 'm1', 'm2', 9, '', 'x'.repeat(400)],
                defaultModel: 'missing',
            })
            const res = await saveKey(user.token, 'groq', 'gsk_models_key_value_5151')
            expect(res.status).toBe(200)
            expect(res.body.data.credential.models).toEqual(['m1', 'm2'])
            expect(res.body.data.credential.defaultModel).toBe('m1')
        })

        it('refuses providers that are not on the list, in any case or spacing', async () => {
            for (const provider of [
                'claude',
                'Groq',
                'GROQ',
                '%20groq',
                'groq%20',
                'x'.repeat(300),
            ]) {
                const res = await saveKey(user.token, provider, 'gsk_whatever_value_1234')
                expect({ provider, status: res.status }).toEqual({ provider, status: 400 })
            }
            expect(await prisma.providerCredential.count({ where: { userId: user.userId } })).toBe(
                0
            )
        })

        it('refuses bad bodies and saves nothing', async () => {
            const bad: unknown[] = [
                {},
                { apiKey: '' },
                { apiKey: '    ' },
                { apiKey: 12345 },
                { apiKey: null },
                { apiKey: ['gsk_list_value'] },
                { apiKey: 'k'.repeat(4097) },
                { apiKey: 'gsk_has space_1234' },
                { apiKey: 'gsk_has_newline\n1234' },
                { apiKey: 'gsk_valid_value_1234', provider: 'openai' },
                { apiKey: 'gsk_valid_value_1234', userId: 'someone-else' },
            ]
            // refused requests count toward the key check limit too, so a second user
            // sends the rest
            const second = await newUser()
            for (const [i, body] of bad.entries()) {
                const res = await api(i < 8 ? user.token : second.token).save('groq', body)
                expect({ body, status: res.status }).toEqual({ body, status: 400 })
                expect(JSON.stringify(res.body)).not.toContain('gsk_valid_value_1234')
            }
            expect(
                await prisma.providerCredential.count({
                    where: { userId: { in: [user.userId, second.userId] } },
                })
            ).toBe(0)
        })
    })

    describe('POST /byok/:provider/refresh', () => {
        it('checks the saved key again and saves the new models', async () => {
            await saveKey(user.token, 'groq', 'gsk_refresh_key_value_6161')
            nextVerify = async ({ apiKey }) => {
                expect(apiKey).toBe('gsk_refresh_key_value_6161')
                return { ok: true, models: ['new-a', 'new-b'], defaultModel: 'new-b' }
            }
            const res = await api(user.token).refresh('groq')
            expect(res.status).toBe(200)
            expect(res.body.data.credential).toMatchObject({
                provider: 'groq',
                keyHint: '6161',
                models: ['new-a', 'new-b'],
                defaultModel: 'new-b',
            })
            expect(JSON.stringify(res.body)).not.toContain('gsk_refresh_key_value_6161')
            const row = await rowOf(user.userId, 'groq')
            expect(row!.models).toEqual(['new-a', 'new-b'])
        })

        it('404 for a provider with no saved key', async () => {
            const res = await api(user.token).refresh('openai')
            expect(res.status).toBe(404)
            expect(res.body.message).toBe('no OpenAI key saved')
        })

        it('refuses a body and a provider that is not on the list', async () => {
            await saveKey(user.token, 'groq', 'gsk_refresh_body_value_7171')
            expect((await api(user.token).refresh('groq', { apiKey: 'x' })).status).toBe(400)
            expect((await api(user.token).refresh('Groq')).status).toBe(400)
            expect((await api(user.token).refresh('nope')).status).toBe(400)
        })

        it('a failed check keeps the saved models and never repeats the key', async () => {
            await saveKey(user.token, 'groq', 'gsk_ok_later_value_8181')
            nextVerify = async ({ apiKey }) => ({
                ok: false,
                reason: 'no_credits',
                message: `account for ${apiKey} is out of credits`,
            })
            const res = await api(user.token).refresh('groq')
            expect(res.status).toBe(400)
            expect(res.body.message).toContain('no credits')
            expect(JSON.stringify(res.body)).not.toContain('gsk_ok_later_value_8181')
            const row = await rowOf(user.userId, 'groq')
            expect(row!.models).toEqual(GROQ_MODELS)
        })

        it('a key replaced during the check keeps the new key and its models', async () => {
            await saveKey(user.token, 'groq', 'gsk_old_key_value_1212')
            nextVerify = async () => {
                // another tab saves a new key while this check runs
                await prisma.providerCredential.update({
                    where: { userId_provider: { userId: user.userId, provider: 'groq' } },
                    data: {
                        encryptedKey: encryptText({
                            text: 'gsk_new_key_value_3434',
                            keyHex: env.SECRETS_ENC_KEY,
                        }),
                        keyHint: '3434',
                        models: ['fresh-model'],
                        defaultModel: 'fresh-model',
                    },
                })
                return { ok: true, models: ['stale-model'], defaultModel: 'stale-model' }
            }
            const res = await api(user.token).refresh('groq')
            expect(res.status).toBe(200)
            expect(res.body.data.credential).toMatchObject({
                keyHint: '3434',
                models: ['fresh-model'],
            })
            const row = await rowOf(user.userId, 'groq')
            expect(row!.models).toEqual(['fresh-model'])
        })

        it('a key removed during the check gives 404, not a server error', async () => {
            await saveKey(user.token, 'groq', 'gsk_removed_key_value_5656')
            nextVerify = async () => {
                await prisma.providerCredential.deleteMany({
                    where: { userId: user.userId, provider: 'groq' },
                })
                return { ok: true, models: GROQ_MODELS, defaultModel: GROQ_MODELS[0] }
            }
            const res = await api(user.token).refresh('groq')
            expect(res.status).toBe(404)
            expect(await rowOf(user.userId, 'groq')).toBeNull()
        })

        it('a saved key that cannot be opened asks to add it again', async () => {
            await saveKey(user.token, 'groq', 'gsk_damaged_key_value_9090')
            await prisma.providerCredential.update({
                where: { userId_provider: { userId: user.userId, provider: 'groq' } },
                data: {
                    encryptedKey: 'aabbccddeeff00112233aabb:00112233445566778899aabbccddeeff:00',
                },
            })
            const res = await api(user.token).refresh('groq')
            expect(res.status).toBe(400)
            expect(res.body.message).toBe('your saved Groq key cannot be read. add it again')
        })
    })

    describe('DELETE /byok/:provider', () => {
        it('deletes a key, and a second delete is a 404', async () => {
            await saveKey(user.token, 'groq', 'gsk_delete_key_value_2323')
            const res = await api(user.token).remove('groq')
            expect(res.status).toBe(200)
            expect(await rowOf(user.userId, 'groq')).toBeNull()
            const again = await api(user.token).remove('groq')
            expect(again.status).toBe(404)
            expect(again.body.message).toBe('no Groq key saved')
        })

        it('404 for a provider with no saved key, 400 for one not on the list', async () => {
            expect((await api(user.token).remove('openai')).status).toBe(404)
            expect((await api(user.token).remove('OpenAI')).status).toBe(400)
            expect((await api(user.token).remove('claude')).status).toBe(400)
        })
    })

    describe('one user cannot reach the keys of another', () => {
        it('refresh and delete touch only your own key', async () => {
            const owner = await newUser()
            await saveKey(owner.token, 'groq', 'gsk_owner_key_value_4545')

            expect((await api(user.token).refresh('groq')).status).toBe(404)
            expect((await api(user.token).remove('groq')).status).toBe(404)
            expect(await rowOf(owner.userId, 'groq')).not.toBeNull()

            // saving your own key for the same provider leaves theirs alone
            await saveKey(user.token, 'groq', 'gsk_mine_key_value_6767')
            const theirs = await rowOf(owner.userId, 'groq')
            expect(
                decryptText({ encryptedText: theirs!.encryptedKey, keyHex: env.SECRETS_ENC_KEY })
            ).toBe('gsk_owner_key_value_4545')
            expect((await api(user.token).remove('groq')).status).toBe(200)
            expect(await rowOf(owner.userId, 'groq')).not.toBeNull()
        })
    })

    describe('the key check limit', () => {
        it('allows 10 saves in 15 minutes per user, then 429', async () => {
            const statuses: number[] = []
            for (let i = 0; i < 11; i++) {
                statuses.push(
                    (await saveKey(user.token, 'groq', `gsk_rate_limit_${i}_abcd`)).status
                )
            }
            expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true)
            expect(statuses[10]).toBe(429)
        })

        it('saves and checks share the limit; the list and delete do not count', async () => {
            await saveKey(user.token, 'groq', 'gsk_shared_limit_value_0101')
            for (let i = 0; i < 9; i++) {
                expect((await api(user.token).refresh('groq')).status).toBe(200)
            }
            expect((await api(user.token).refresh('groq')).status).toBe(429)
            expect((await saveKey(user.token, 'groq', 'gsk_over_limit_1234')).status).toBe(429)
            expect((await api(user.token).list()).status).toBe(200)
            expect((await api(user.token).remove('groq')).status).toBe(200)
        })

        it('the limit is per user', async () => {
            const other = await newUser()
            for (let i = 0; i < 10; i++) await saveKey(user.token, 'groq', `gsk_fill_${i}_value_ab`)
            expect((await saveKey(user.token, 'groq', 'gsk_fill_x_value_ab')).status).toBe(429)
            expect((await saveKey(other.token, 'groq', 'gsk_other_value_abcd')).status).toBe(200)
        })
    })

    describe('the repository', () => {
        it('updateVerification changes the row only while it holds the checked key', async () => {
            await saveKey(user.token, 'groq', 'gsk_repo_key_value_7878')
            const row = await rowOf(user.userId, 'groq')
            const base = {
                userId: user.userId,
                provider: 'groq',
                models: ['m'],
                defaultModel: 'm',
                verifiedAt: new Date(),
            }
            expect(
                await byokRepository.updateVerification({ ...base, encryptedKey: 'other' })
            ).toBe(false)
            expect((await rowOf(user.userId, 'groq'))!.models).toEqual(GROQ_MODELS)
            expect(
                await byokRepository.updateVerification({
                    ...base,
                    encryptedKey: row!.encryptedKey,
                })
            ).toBe(true)
            expect((await rowOf(user.userId, 'groq'))!.models).toEqual(['m'])
        })

        it('reads never return the encrypted key, except the one made for a check', async () => {
            await saveKey(user.token, 'groq', 'gsk_repo_read_value_8989')
            const list = await byokRepository.findCredentialsByUser(user.userId)
            const summary = await byokRepository.findCredentialSummary(user.userId, 'groq')
            expect('encryptedKey' in list[0]!).toBe(false)
            expect('encryptedKey' in summary!).toBe(false)
            const withKey = await byokRepository.findCredentialWithKey(user.userId, 'groq')
            expect(withKey!.encryptedKey).toBeDefined()
        })
    })

    describe('runs and the model source', () => {
        it('starts an own-key session with a $0 balance, but not a credits session', async () => {
            await saveKey(user.token, 'groq', 'gsk_session_key_value_1313')
            const post = (body: object) =>
                request(app)
                    .post('/api/v1/session')
                    .set('x-forwarded-for', getRandomIP())
                    .set('Authorization', `Bearer ${user.token}`)
                    .send(body)

            expect((await post({ prompt: 'build a todo app' })).status).toBe(402)
            expect(
                (
                    await post({
                        prompt: 'build a todo app',
                        billingSource: 'OWN_KEY',
                        provider: 'groq',
                        model: GROQ_MODELS[0],
                    })
                ).status
            ).toBe(201)
            expect(
                (
                    await post({
                        prompt: 'build a todo app',
                        billingSource: 'OWN_KEY',
                        provider: 'groq',
                        model: 'gpt-5',
                    })
                ).status
            ).toBe(400)
            expect(
                (
                    await post({
                        prompt: 'x',
                        billingSource: 'OWN_KEY',
                        provider: 'openai',
                        model: 'gpt-5',
                    })
                ).status
            ).toBe(400)
        })

        it('the model source setting is gone', async () => {
            const res = await request(app)
                .patch('/api/v1/setting/model-source')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${user.token}`)
                .send({ defaultModelSource: 'OWN_KEY' })
            expect(res.status).toBe(404)
        })

        it('a github run reads the balance and the saved keys, the key used last first', async () => {
            await prisma.user.update({
                where: { id: user.userId },
                data: { creditBalance: 25 },
            })
            const owner = await githubAppRepository.findRunOwner(user.userId)
            expect(owner?.creditBalance).toBe(25)

            await saveKey(user.token, 'groq', 'gsk_github_run_value_1414')
            await saveKey(user.token, 'openai', 'sk-github-run-value-1515')
            await prisma.providerCredential.update({
                where: { userId_provider: { userId: user.userId, provider: 'groq' } },
                data: { lastUsedAt: new Date() },
            })
            const keys = await githubAppRepository.findOwnKeys(user.userId)
            expect(keys.map((k) => k.provider)).toEqual(['groq', 'openai'])
            expect(keys[0]).toEqual({
                provider: 'groq',
                defaultModel: GROQ_MODELS[0],
                models: GROQ_MODELS,
            })
            expect(JSON.stringify(keys)).not.toContain('encryptedKey')

            const other = await newUser()
            expect(await githubAppRepository.findOwnKeys(other.userId)).toEqual([])
        })
    })

    it('leaves own-key usage out of the credits used totals', async () => {
        const now = new Date()
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        const event = (billingSource: 'CREDITS' | 'OWN_KEY', costInCents: number) => ({
            userId: user.userId,
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
        const get = (path: string) =>
            request(app)
                .get(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${user.token}`)

        const usage = await get('/usage')
        expect(usage.status).toBe(200)
        expect(JSON.stringify(usage.body)).toContain('"usedInCents":12')

        await prisma.usageEvent.deleteMany({ where: { userId: user.userId } })
    })

    it('removes saved keys when the account is deleted', async () => {
        expect((await saveKey(user.token, 'groq', 'gsk_leaving_value_1111')).status).toBe(200)
        const res = await request(app)
            .delete('/api/v1/auth/account')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${user.token}`)
        expect(res.status).toBe(200)
        expect(await prisma.providerCredential.count({ where: { userId: user.userId } })).toBe(0)
    })
})
