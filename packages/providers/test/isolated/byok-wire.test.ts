// runs in its own bun process (see package.json): the integration tests replace the
// openai, anthropic and gemini sdks with mock.module, which would hide the real requests
// these tests inspect.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { createByokProvider, verifyByokKey } from '../../src/byok.ts'
import { DYNAMIC_ENDPOINTS } from '../../src/providers/dynamic-registry.ts'

const SENTINEL = 'ENV-KEY-MUST-NOT-LEAK'
const ENV_VARS = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'GEMINI_API_KEY',
    'OPENROUTER_API_KEY',
    'KIMI_API_KEY',
    'TINKER_API_KEY',
    'WATSONX_AI_APIKEY',
    'WATSONX_PROJECT_ID',
    ...Object.values(DYNAMIC_ENDPOINTS)
        .map((e) => e.envVar)
        .filter((v): v is string => Boolean(v)),
]

// options the sdk clients read from env on their own when they are not set
const SDK_ENV: Record<string, string> = {
    OPENAI_BASE_URL: 'https://env-leak.invalid/v1',
    ANTHROPIC_BASE_URL: 'https://env-leak.invalid',
    OPENAI_ORG_ID: SENTINEL,
    OPENAI_PROJECT_ID: SENTINEL,
    GOOGLE_API_KEY: SENTINEL,
    GOOGLE_GENAI_USE_VERTEXAI: 'true',
    GOOGLE_CLOUD_PROJECT: SENTINEL,
    GOOGLE_CLOUD_LOCATION: 'us-central1',
}

const USER_KEY = 'user-own-key-123'
const WATSONX_KEY = 'ibm-user-key:6f1c2a9e-1111-4222-8333-944455556666'

type Captured = { url: string; headers: Record<string, string>; body?: string }

let savedEnv: Record<string, string | undefined> = {}
let savedFetch: typeof fetch
let captured: Captured[] = []

const headersOf = (init?: RequestInit, input?: any): Record<string, string> => {
    const out: Record<string, string> = {}
    const source = init?.headers ?? (input instanceof Request ? input.headers : undefined)
    new Headers(source as HeadersInit | undefined).forEach((value, key) => {
        out[key.toLowerCase()] = value
    })
    return out
}

beforeEach(() => {
    savedEnv = {}
    for (const name of ENV_VARS) {
        savedEnv[name] = process.env[name]
        process.env[name] = SENTINEL
    }
    for (const [name, value] of Object.entries(SDK_ENV)) {
        savedEnv[name] = process.env[name]
        process.env[name] = value
    }
    savedFetch = globalThis.fetch
    captured = []
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input?.url || String(input)
        captured.push({
            url,
            headers: headersOf(init, input),
            body: typeof init?.body === 'string' ? init.body : undefined,
        })
        // the ibm iam exchange answers with a token so watsonx reaches the chat call
        if (url.includes('iam.cloud.ibm.com')) {
            return new Response(JSON.stringify({ access_token: 'iam-token', expires_in: 3600 }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }
        return new Response(JSON.stringify({ error: { message: 'stub: unauthorized' } }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
        })
    }) as typeof fetch
})

afterEach(() => {
    for (const name of [...ENV_VARS, ...Object.keys(SDK_ENV)]) {
        if (savedEnv[name] === undefined) delete process.env[name]
        else process.env[name] = savedEnv[name]
    }
    globalThis.fetch = savedFetch
})

const runOnce = async (provider: string, apiKey: string) => {
    const client = createByokProvider({ provider, apiKey })
    try {
        for await (const _chunk of client.stream([{ role: 'user', content: 'hi' }], undefined, '', {
            model: 'test-model',
        })) {
            break
        }
    } catch {
        // Intentionally swallowed: the stub answers 401, the test reads the captured request
    }
}

const allSentRequests = () => JSON.stringify(captured)

const expectNoEnvLeak = () => {
    const sent = allSentRequests()
    expect(sent).not.toContain(SENTINEL)
    expect(sent).not.toContain('env-leak.invalid')
}

describe('createByokProvider', () => {
    const cases: Array<{ provider: string; key: string; header: string; expected: string }> = [
        {
            provider: 'openai',
            key: USER_KEY,
            header: 'authorization',
            expected: `Bearer ${USER_KEY}`,
        },
        { provider: 'anthropic', key: USER_KEY, header: 'x-api-key', expected: USER_KEY },
        { provider: 'google', key: USER_KEY, header: 'x-goog-api-key', expected: USER_KEY },
        {
            provider: 'openrouter',
            key: USER_KEY,
            header: 'authorization',
            expected: `Bearer ${USER_KEY}`,
        },
        { provider: 'kimi', key: USER_KEY, header: 'x-api-key', expected: USER_KEY },
        {
            provider: 'groq',
            key: USER_KEY,
            header: 'authorization',
            expected: `Bearer ${USER_KEY}`,
        },
        {
            provider: 'deepseek',
            key: USER_KEY,
            header: 'authorization',
            expected: `Bearer ${USER_KEY}`,
        },
    ]

    for (const c of cases) {
        it(`${c.provider} sends only the user's key, never an env key`, async () => {
            await runOnce(c.provider, c.key)
            expect(captured.length).toBeGreaterThan(0)
            expect(captured.some((r) => r.headers[c.header] === c.expected)).toBe(true)
            expectNoEnvLeak()
        })
    }

    it('thinkingmachines sends the user key as its token', async () => {
        await runOnce('thinkingmachines', USER_KEY)
        expect(allSentRequests()).toContain(USER_KEY)
        expectNoEnvLeak()
    })

    it('watsonx exchanges the user key and sends the project id from the key', async () => {
        await runOnce('watsonx', WATSONX_KEY)
        expect(allSentRequests()).toContain('ibm-user-key')
        expect(allSentRequests()).toContain('6f1c2a9e-1111-4222-8333-944455556666')
        expectNoEnvLeak()
    })
})

describe('verifyByokKey over the wire', () => {
    const jsonFetch = (status: number, body: unknown): typeof fetch =>
        (async () =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' },
            })) as typeof fetch

    it('confirms with a 1-token request when the model list ignores the key', async () => {
        // the list answers 200, the chat request (global fetch stub) answers 401
        const result = await verifyByokKey({
            provider: 'sambanova',
            apiKey: USER_KEY,
            fetchFn: jsonFetch(200, { data: [{ id: 'Meta-Llama-3.3-70B-Instruct' }] }),
        })
        expect(result).toMatchObject({ ok: false, reason: 'bad_key' })
        expect(captured.some((r) => r.headers.authorization === `Bearer ${USER_KEY}`)).toBe(true)
        expectNoEnvLeak()
    })
})
