import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'

import {
    getProviderModels,
    getModelLabel,
    getModelContextWindow,
    isValidModelForProvider,
    getDefaultModelForProvider,
    ensureValidModelForProvider,
    fetchLiveProviderModels,
    checkProviderKey,
    getCuratedProviderModels,
    pickModelForProvider,
    getLiveProviderModels,
    clearProviderModelsCache,
    markModelUnavailable,
    LIVE_MODEL_CACHE_TTL_MS,
} from '../src/utils/models'

describe('models utils', () => {
    const testConfigDir = path.join(os.tmpdir(), `december-test-models-${Date.now()}`)

    beforeAll(() => {
        clearProviderModelsCache()
        fs.mkdirSync(testConfigDir, { recursive: true })
        process.env.DECEMBER_CONFIG_DIR = testConfigDir
    })

    afterAll(() => {
        clearProviderModelsCache()
        fs.rmSync(testConfigDir, { recursive: true, force: true })
    })
    describe('getProviderModels', () => {
        it('returns anthropic models when provider is anthropic', () => {
            const models = getProviderModels('anthropic')
            expect(models).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 'claude-fable-5-1' }),
                    expect.objectContaining({ value: 'claude-opus-5' }),
                    expect.objectContaining({ value: 'claude-sonnet-5' }),
                ])
            )
            expect(models.length).toBeGreaterThanOrEqual(11)
        })

        it('returns google models when provider is google', () => {
            const models = getProviderModels('google')
            expect(models).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 'gemini-3.8-flash' }),
                    expect.objectContaining({ value: 'gemini-3.7-flash' }),
                    expect.objectContaining({ value: 'gemini-3.6-flash' }),
                ])
            )
            expect(models.length).toBeGreaterThanOrEqual(11)
        })

        it('returns openai models when provider is openai', () => {
            const models = getProviderModels('openai')
            expect(models).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 'gpt-5.6-sol' }),
                    expect.objectContaining({ value: 'o4-mini' }),
                    expect.objectContaining({ value: 'gpt-4o' }),
                ])
            )
            expect(models.length).toBeGreaterThanOrEqual(17)
        })

        it('returns minimax models when provider is minimax', () => {
            const models = getProviderModels('minimax')
            expect(models).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 'MiniMax-M3' }),
                    expect.objectContaining({ value: 'MiniMax-M2.7' }),
                    expect.objectContaining({ value: 'MiniMax-M2.7-highspeed' }),
                    expect.objectContaining({ value: 'MiniMax-M2.5' }),
                ])
            )
            expect(models.length).toBeGreaterThanOrEqual(9)
        })

        it('returns sakana models when provider is sakana', () => {
            const models = getProviderModels('sakana')
            expect(models).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 'fugu' }),
                    expect.objectContaining({ value: 'fugu-ultra' }),
                    expect.objectContaining({ value: 'sakana-namazu' }),
                ])
            )
            expect(models.length).toBeGreaterThanOrEqual(4)
        })

        it('returns openrouter models with free and paid models when provider is openrouter', () => {
            const models = getProviderModels('openrouter')
            expect(models).toEqual(
                expect.arrayContaining([
                    // catalog checked against openrouter /models on 2026-11-21 (#619)
                    expect.objectContaining({
                        label: 'Google: Gemma 4 26B A4B  (free)',
                        value: 'google/gemma-4-26b-a4b-it:free',
                    }),
                    expect.objectContaining({
                        label: 'Anthropic: Claude Opus 5',
                        value: 'anthropic/claude-opus-5',
                    }),
                ])
            )
            expect(models.length).toBeGreaterThanOrEqual(17)
        })

        it('returns default model when provider is unknown', () => {
            const models = getProviderModels('unknown-provider')
            expect(models).toEqual([{ label: 'Default', value: 'default' }])
        })
    })

    describe('isValidModelForProvider', () => {
        it('validates model existence for provider', () => {
            expect(isValidModelForProvider('anthropic', 'claude-sonnet-5')).toBe(true)
            expect(isValidModelForProvider('anthropic', 'gpt-4o')).toBe(false)
            expect(isValidModelForProvider('openai', 'gpt-4o')).toBe(true)
            expect(isValidModelForProvider('december_proxy', 'december-auto')).toBe(true)
            expect(isValidModelForProvider('december_proxy', 'gemini-3.7-flash')).toBe(false)
            expect(
                isValidModelForProvider('openrouter', 'meta-llama/llama-3.3-70b-instruct:free')
            ).toBe(true)
            expect(isValidModelForProvider('openrouter', 'custom/dynamic-model')).toBe(true)
        })
    })

    describe('getDefaultModelForProvider', () => {
        it('returns first available model for provider', () => {
            expect(getDefaultModelForProvider('anthropic')).toBe('claude-opus-5')
            expect(getDefaultModelForProvider('openai')).toBe('gpt-5.6-sol')
            expect(getDefaultModelForProvider('december_proxy')).toBe('december-auto')
            expect(getDefaultModelForProvider('copilot')).toBe('gpt-4o')
        })
    })

    describe('ensureValidModelForProvider', () => {
        it('preserves valid model for the target provider', () => {
            expect(ensureValidModelForProvider('anthropic', 'claude-sonnet-5')).toBe(
                'claude-sonnet-5'
            )
            expect(ensureValidModelForProvider('openai', 'gpt-4o')).toBe('gpt-4o')
            expect(ensureValidModelForProvider('copilot', 'gpt-4o')).toBe('gpt-4o')
            expect(ensureValidModelForProvider('december_proxy', 'december-auto')).toBe(
                'december-auto'
            )
        })

        it('auto-switches to provider recommended model if current model is invalid for provider', () => {
            expect(ensureValidModelForProvider('anthropic', 'gpt-4o')).toBe('claude-opus-5')
            expect(ensureValidModelForProvider('openai', 'claude-sonnet-5')).toBe('gpt-5.6-sol')
            expect(ensureValidModelForProvider('google', 'gpt-5.6-sol')).toBe('gemini-3.8-flash')
            expect(ensureValidModelForProvider('copilot', 'gpt-5.6-sol')).toBe('gpt-4o')
            expect(ensureValidModelForProvider('deepseek', 'gemini-3.7-flash')).toBe(
                'deepseek-v4-pro'
            )
        })

        it('auto-switches to provider recommended model if current model is undefined', () => {
            expect(ensureValidModelForProvider('anthropic')).toBe('claude-opus-5')
            expect(ensureValidModelForProvider('openai', undefined)).toBe('gpt-5.6-sol')
        })
    })

    describe('getModelLabel', () => {
        it('returns correct label for a known model value', () => {
            expect(getModelLabel('gemini-3.7-flash')).toBe('Gemini 3.7 Flash')
            expect(getModelLabel('gemini-3.6-flash')).toBe('Gemini 3.6 Flash')
            expect(getModelLabel('claude-opus-5')).toBe('Claude Opus 5')
            expect(getModelLabel('gpt-5.6-sol')).toBe('GPT-5.6 Sol')
            expect(getModelLabel('o4-mini')).toBe('o4 Mini')
            expect(getModelLabel('december-auto')).toBe('Humans R1')
        })

        it('returns the value itself if model is not found', () => {
            const label = getModelLabel('unknown-model')
            expect(label).toBe('unknown-model')
        })
    })

    describe('getModelContextWindow', () => {
        it('returns 1000000 for gemini models', () => {
            expect(getModelContextWindow('gemini-3.7-flash')).toBe(1000000)
            expect(getModelContextWindow('gemini-3.6-flash')).toBe(1000000)
        })

        it('returns 200000 for claude models', () => {
            expect(getModelContextWindow('claude-3-7-sonnet-latest')).toBe(200000)
        })

        it('returns 200000 for o3-mini/o1 models', () => {
            expect(getModelContextWindow('o3-mini')).toBe(200000)
        })

        it('returns 128000 for gpt-4 and deepseek models', () => {
            expect(getModelContextWindow('gpt-4o')).toBe(128000)
            expect(getModelContextWindow('deepseek-chat')).toBe(128000)
        })

        it('returns 100000 as default', () => {
            expect(getModelContextWindow('unknown-model')).toBe(100000)
        })
    })

    describe('fetchLiveProviderModels & Caching', () => {
        const json = (body: unknown, status = 200) =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/json' },
            })

        it('reports no_key instead of a curated list when no API key is given', async () => {
            const result = await fetchLiveProviderModels('deepseek')
            expect(result).toEqual({ ok: false, reason: 'no_key' })
        })

        it('D1: lists only the models the provider returned, in catalog order', async () => {
            clearProviderModelsCache()
            const mockFetch = async () =>
                json({
                    data: [
                        { id: 'deepseek-custom-fine-tuned-v1' },
                        { id: 'deepseek-v4-flash' },
                        { id: 'deepseek-v4-pro' },
                    ],
                })

            const result = await fetchLiveProviderModels(
                'deepseek',
                'mock-api-key',
                undefined,
                mockFetch as any
            )
            expect(result.ok).toBe(true)
            const values = result.ok === true ? result.models.map((m) => m.value) : []
            // catalog models first, in catalog order, then the rest
            const returned = [
                'deepseek-custom-fine-tuned-v1',
                'deepseek-v4-flash',
                'deepseek-v4-pro',
            ]
            const catalogOrder = getCuratedProviderModels('deepseek')
                .map((m) => m.value)
                .filter((id) => returned.includes(id))
            expect(values.slice(0, catalogOrder.length)).toEqual(catalogOrder)
            expect(values).toContain('deepseek-custom-fine-tuned-v1')
            // a catalog model the provider did not return is gone from /model
            const notReturned = getCuratedProviderModels('deepseek').find(
                (m) => !values.includes(m.value)
            )
            if (notReturned) {
                expect(
                    getProviderModels('deepseek').some((m) => m.value === notReturned.value)
                ).toBe(false)
                expect(isValidModelForProvider('deepseek', notReturned.value)).toBe(false)
            }
            expect(isValidModelForProvider('deepseek', 'deepseek-custom-fine-tuned-v1')).toBe(true)
        })

        it('returns the failure type for a bad key, forbidden, no endpoint and network', async () => {
            clearProviderModelsCache()
            const cases: [Response | Error, string][] = [
                [
                    json({ error: { message: 'Invalid API Key', code: 'invalid_api_key' } }, 401),
                    'bad_key',
                ],
                [
                    json(
                        {
                            error: {
                                message: 'API key not valid',
                                status: 'INVALID_ARGUMENT',
                                details: [{ reason: 'API_KEY_INVALID' }],
                            },
                        },
                        400
                    ),
                    'bad_key',
                ],
                [
                    json(
                        { code: 'invalid-argument', error: 'Incorrect API key provided: xa***' },
                        400
                    ),
                    'bad_key',
                ],
                [
                    json({ code: 'permission-denied', error: 'team has no credits' }, 403),
                    'forbidden',
                ],
                [json({ detail: 'Access is blocked due to billing status.' }, 402), 'forbidden'],
                [json({ detail: 'Not Found' }, 404), 'no_endpoint'],
                [json({ error: 'busy' }, 503), 'network'],
                [new Error('Network timeout'), 'network'],
            ]
            for (const [answer, reason] of cases) {
                clearProviderModelsCache()
                const mockFetch = async () => {
                    if (answer instanceof Error) throw answer
                    return answer.clone()
                }
                const result = await fetchLiveProviderModels(
                    'groq',
                    'k',
                    undefined,
                    mockFetch as any
                )
                expect(result.ok === false ? result.reason : 'ok').toBe(reason)
            }
            // a failed check never replaces the catalog
            expect(getProviderModels('groq')).toEqual(getCuratedProviderModels('groq'))
        })

        it('LIVE_MODEL_CACHE_TTL_MS is configured to 24 hours', () => {
            expect(LIVE_MODEL_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
        })

        it('caches fetched models for 24 hours and avoids re-fetching within TTL', async () => {
            clearProviderModelsCache()

            let fetchCalls = 0
            const mockFetch = async () => {
                fetchCalls++
                return json({ data: [{ id: 'copilot-test-model' }] })
            }

            const first = await fetchLiveProviderModels(
                'copilot',
                'token-a',
                undefined,
                mockFetch as any
            )
            expect(fetchCalls).toBe(1)
            expect(
                first.ok === true && first.models.some((m) => m.value === 'copilot-test-model')
            ).toBe(true)

            const second = await fetchLiveProviderModels(
                'copilot',
                'token-a',
                undefined,
                mockFetch as any
            )
            expect(fetchCalls).toBe(1)
            expect(second).toEqual(first)
        })

        it('never writes the raw key into the cache file', async () => {
            clearProviderModelsCache()
            const mockFetch = async () => json({ data: [{ id: 'groq-model' }] })
            await fetchLiveProviderModels(
                'groq',
                'gsk_secret_value_123',
                undefined,
                mockFetch as any
            )
            await new Promise((r) => setTimeout(r, 50))
            const file = path.join(testConfigDir, 'models-cache.json')
            if (fs.existsSync(file)) {
                expect(fs.readFileSync(file, 'utf8')).not.toContain('gsk_secret_value_123')
            }
        })

        it('drops cache entries written by older versions that held the raw key', async () => {
            clearProviderModelsCache()
            const file = path.join(testConfigDir, 'models-cache.json')
            fs.writeFileSync(
                file,
                JSON.stringify({
                    'groq:gsk_old_raw_secret_value:default': {
                        timestamp: Date.now(),
                        models: [{ label: 'x', value: 'x' }],
                    },
                })
            )
            process.env.DECEMBER_TEST_LOAD_CACHE = '1'
            try {
                expect(getLiveProviderModels('groq')).toBeUndefined()
                await new Promise((r) => setTimeout(r, 50))
                expect(fs.readFileSync(file, 'utf8')).not.toContain('gsk_old_raw_secret_value')
            } finally {
                delete process.env.DECEMBER_TEST_LOAD_CACHE
            }
        })

        it('asks the kimi code endpoint that chat uses, not the moonshot platform', async () => {
            clearProviderModelsCache()
            let capturedUrl = ''
            let capturedHeaders: any = {}
            const mockFetch = async (url: string, init?: any) => {
                capturedUrl = url
                capturedHeaders = init?.headers || {}
                return json({ data: [{ id: 'kimi-for-coding' }] })
            }

            await fetchLiveProviderModels('kimi', 'mock-kimi-key', undefined, mockFetch as any)
            expect(capturedUrl).toBe('https://api.kimi.com/coding/v1/models')
            expect(capturedHeaders['Authorization']).toBe('Bearer mock-kimi-key')

            await fetchLiveProviderModels(
                'moonshot',
                'mock-moonshot-key',
                undefined,
                mockFetch as any
            )
            expect(capturedUrl).toBe('https://api.moonshot.ai/v1/models')
        })

        it('uses the antigravity backend for gemini subscription oauth tokens', async () => {
            clearProviderModelsCache()
            let capturedUrl = ''
            let capturedInit: any = {}
            const mockFetch = async (url: string, init?: any) => {
                capturedUrl = url
                capturedInit = init || {}
                return json({ models: { 'gemini-custom-flash': { displayName: 'Gemini Custom' } } })
            }

            const result = await fetchLiveProviderModels(
                'gemini',
                'ya29.mock-oauth-token',
                undefined,
                mockFetch as any
            )
            expect(capturedUrl).toContain('fetchAvailableModels')
            expect(capturedInit.method).toBe('POST')
            expect(capturedInit.headers['Authorization']).toBe('Bearer ya29.mock-oauth-token')
            expect(
                result.ok === true && result.models.some((m) => m.value === 'gemini-custom-flash')
            ).toBe(true)
        })

        it('sends ai studio keys (AIza and AQ.) in x-goog-api-key, not as a bearer token', async () => {
            for (const key of ['AIzaSyMockKey123', 'AQ.Ab8MockKey.withdots']) {
                clearProviderModelsCache()
                let capturedUrl = ''
                let capturedHeaders: any = {}
                const mockFetch = async (url: string, init?: any) => {
                    capturedUrl = url
                    capturedHeaders = init?.headers || {}
                    return json({
                        models: [
                            {
                                name: 'models/gemini-custom-pro',
                                supportedGenerationMethods: ['generateContent'],
                            },
                            {
                                name: 'models/text-embedding-9',
                                supportedGenerationMethods: ['embedContent'],
                            },
                        ],
                    })
                }
                const result = await fetchLiveProviderModels(
                    'google',
                    key,
                    undefined,
                    mockFetch as any
                )
                expect(
                    capturedUrl.startsWith(
                        'https://generativelanguage.googleapis.com/v1beta/models'
                    )
                ).toBe(true)
                expect(capturedUrl).not.toContain(key)
                expect(capturedHeaders['x-goog-api-key']).toBe(key)
                expect(capturedHeaders['Authorization']).toBeUndefined()
                const values = result.ok === true ? result.models.map((m) => m.value) : []
                expect(values).toEqual(['gemini-custom-pro'])
            }
        })

        it('uses Bearer and oauth-beta header for Claude subscription tokens', async () => {
            clearProviderModelsCache()
            let capturedHeaders: any = {}
            const mockFetch = async (_url: string, init?: any) => {
                capturedHeaders = init?.headers || {}
                return json({ data: [{ id: 'claude-custom-v1' }] })
            }

            const result = await fetchLiveProviderModels(
                'claude',
                'mock-oauth-session-token',
                undefined,
                mockFetch as any
            )
            expect(capturedHeaders['Authorization']).toBe('Bearer mock-oauth-session-token')
            expect(capturedHeaders['anthropic-beta']).toBe('claude-code-20250219,oauth-2024-06-20')
            expect(
                result.ok === true && result.models.some((m) => m.value === 'claude-custom-v1')
            ).toBe(true)
        })

        it('uses x-api-key without oauth-beta header for standard Anthropic API keys', async () => {
            clearProviderModelsCache()
            let capturedHeaders: any = {}
            const mockFetch = async (_url: string, init?: any) => {
                capturedHeaders = init?.headers || {}
                return json({ data: [{ id: 'claude-sonnet-5' }] })
            }

            await fetchLiveProviderModels(
                'anthropic',
                'sk-ant-api03-mock',
                undefined,
                mockFetch as any
            )
            expect(capturedHeaders['x-api-key']).toBe('sk-ant-api03-mock')
            expect(capturedHeaders['Authorization']).toBeUndefined()
            expect(capturedHeaders['anthropic-beta']).toBeUndefined()
        })

        it('markModelUnavailable removes unavailable model from provider list and future queries', () => {
            clearProviderModelsCache()
            const initialModels = getProviderModels('openai')
            const targetModel = initialModels[0]?.value
            expect(targetModel).toBeDefined()

            markModelUnavailable('openai', targetModel!)
            const updatedModels = getProviderModels('openai')
            expect(updatedModels.some((m) => m.value === targetModel)).toBe(false)
        })
    })

    describe('checkProviderKey (D4)', () => {
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

        it('rejects a key the provider does not know, and keeps the old list', async () => {
            clearProviderModelsCache()
            const good = async () => json({ data: [{ id: 'old-key-model' }] })
            await fetchLiveProviderModels('groq', 'old-key', undefined, good as any)

            const bad = async () => json({ error: { message: 'Invalid API Key' } }, 401)
            const result = await checkProviderKey('groq', 'new-bad-key', undefined, bad as any)
            expect(result).toEqual({
                status: 'rejected',
                message: 'Invalid API Key',
                httpStatus: 401,
            })
            expect(getProviderModels('groq').map((m) => m.value)).toEqual(['old-key-model'])
        })

        it('accepts a valid key and drops the list read with the old key', async () => {
            clearProviderModelsCache()
            await fetchLiveProviderModels('groq', 'old-key', undefined, (async () =>
                json({ data: [{ id: 'old-key-model' }] })) as any)
            const result = await checkProviderKey('groq', 'new-key', undefined, (async () =>
                json({ data: [{ id: 'new-key-model' }] })) as any)
            expect(result.status).toBe('valid')
            expect(getProviderModels('groq').map((m) => m.value)).toEqual(['new-key-model'])
        })

        it('saves a forbidden key and passes on the provider reason', async () => {
            clearProviderModelsCache()
            const result = await checkProviderKey('xai', 'xai-key', undefined, (async () =>
                json({ code: 'permission-denied', error: 'no credits yet' }, 403)) as any)
            expect(result).toEqual({
                status: 'forbidden',
                message: 'no credits yet',
                httpStatus: 403,
            })
        })

        it('cannot verify keys where the model list answers any key', async () => {
            clearProviderModelsCache()
            const result = await checkProviderKey('nvidia', 'nvapi-any', undefined, (async () =>
                json({ data: [{ id: 'meta/llama-4' }] })) as any)
            expect(result.status).toBe('unverified')
        })

        it('checks openrouter keys with /key because its model list is public', async () => {
            clearProviderModelsCache()
            const urls: string[] = []
            const mockFetch = async (url: string) => {
                urls.push(url)
                return url.endsWith('/key')
                    ? json({ error: { message: 'User not found.', code: 401 } }, 401)
                    : json({ data: [{ id: 'x/y' }] })
            }
            const result = await checkProviderKey(
                'openrouter',
                'sk-or-bad',
                undefined,
                mockFetch as any
            )
            expect(result.status).toBe('rejected')
            expect(urls).toEqual(['https://openrouter.ai/api/v1/key'])
        })

        it('reports unverified for providers without a model list', async () => {
            const result = await checkProviderKey('amazon-q', 'token', undefined, (async () =>
                json({})) as any)
            expect(result).toEqual({
                status: 'unverified',
                reason: 'no_endpoint',
                message: undefined,
            })
        })
    })

    describe('pickModelForProvider (D5)', () => {
        it('picks the catalog default when the provider offers it', async () => {
            clearProviderModelsCache()
            await fetchLiveProviderModels(
                'anthropic',
                'k1',
                undefined,
                (async () =>
                    new Response(
                        JSON.stringify({
                            data: [{ id: 'claude-sonnet-5' }, { id: 'claude-opus-5' }],
                        })
                    )) as any
            )
            expect(pickModelForProvider('anthropic')).toBe('claude-opus-5')
        })

        it('never picks the model that failed', async () => {
            clearProviderModelsCache()
            await fetchLiveProviderModels(
                'anthropic',
                'k1',
                undefined,
                (async () =>
                    new Response(
                        JSON.stringify({
                            data: [{ id: 'claude-sonnet-5' }, { id: 'claude-opus-5' }],
                        })
                    )) as any
            )
            expect(pickModelForProvider('anthropic', ['claude-opus-5'])).toBe('claude-sonnet-5')
        })

        it('falls back to the first returned model when no catalog model is offered', async () => {
            clearProviderModelsCache()
            await fetchLiveProviderModels(
                'groq',
                'k1',
                undefined,
                (async () =>
                    new Response(JSON.stringify({ data: [{ id: 'brand-new-model' }] }))) as any
            )
            expect(pickModelForProvider('groq')).toBe('brand-new-model')
            expect(pickModelForProvider('groq', ['brand-new-model'])).toBeUndefined()
        })

        it('uses the catalog when there is no live list', () => {
            clearProviderModelsCache()
            expect(pickModelForProvider('openai')).toBe('gpt-5.6-sol')
            expect(pickModelForProvider('openai', ['gpt-5.6-sol'])).not.toBe('gpt-5.6-sol')
        })
    })
})
