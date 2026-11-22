import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
    BYOK_PROVIDERS,
    ByokError,
    createByokProvider,
    normalizeByokKey,
    verifyByokKey,
} from '../../src/byok.ts'
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

describe('byok provider list', () => {
    it('builds a client with the right id for every byok provider', () => {
        for (const p of BYOK_PROVIDERS) {
            const key = p.id === 'watsonx' ? WATSONX_KEY : USER_KEY
            const client = createByokProvider({ provider: p.id, apiKey: key })
            expect(client.id).toBe(p.id)
            expect(typeof client.stream).toBe('function')
        }
    })

    it('has the 42 cli byok providers', () => {
        expect(BYOK_PROVIDERS).toHaveLength(42)
        expect(new Set(BYOK_PROVIDERS.map((p) => p.id)).size).toBe(42)
    })
})

describe('normalizeByokKey', () => {
    const codeOf = (fn: () => unknown) => {
        try {
            fn()
            return null
        } catch (error) {
            return error instanceof ByokError ? error.code : 'other'
        }
    }

    it('refuses an empty or blank key', () => {
        expect(codeOf(() => normalizeByokKey({ provider: 'openai', apiKey: '' }))).toBe(
            'missing_key'
        )
        expect(codeOf(() => createByokProvider({ provider: 'groq', apiKey: '   ' }))).toBe(
            'missing_key'
        )
    })

    it('refuses providers outside the byok list, including plan providers', () => {
        for (const provider of ['claude', 'codex', 'copilot', 'gemini', 'amazon-q', 'nope']) {
            expect(codeOf(() => normalizeByokKey({ provider, apiKey: USER_KEY }))).toBe(
                'unknown_provider'
            )
        }
    })

    it('refuses a claude plan token for anthropic', () => {
        expect(
            codeOf(() => normalizeByokKey({ provider: 'anthropic', apiKey: 'sk-ant-oat01-abc' }))
        ).toBe('plan_token_not_allowed')
        expect(
            codeOf(() => normalizeByokKey({ provider: 'anthropic', apiKey: 'Bearer abc' }))
        ).toBe('plan_token_not_allowed')
    })

    it('needs API_KEY:PROJECT_ID for watsonx', () => {
        expect(codeOf(() => normalizeByokKey({ provider: 'watsonx', apiKey: 'only-key' }))).toBe(
            'missing_project_id'
        )
        expect(normalizeByokKey({ provider: 'watsonx', apiKey: ` ${WATSONX_KEY} ` })).toBe(
            WATSONX_KEY
        )
    })
})

describe('verifyByokKey', () => {
    const jsonFetch = (status: number, body: unknown): typeof fetch =>
        (async () =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' },
            })) as typeof fetch

    it('returns the models and a default model for a working key', async () => {
        const result = await verifyByokKey({
            provider: 'groq',
            apiKey: USER_KEY,
            fetchFn: jsonFetch(200, {
                data: [{ id: 'llama-3.3-70b-versatile' }, { id: 'qwen-qwq-32b' }],
            }),
        })
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.models).toContain('llama-3.3-70b-versatile')
            expect(result.models).toContain(result.defaultModel)
        }
    })

    it('reports bad_key for a rejected key', async () => {
        const result = await verifyByokKey({
            provider: 'groq',
            apiKey: USER_KEY,
            fetchFn: jsonFetch(401, { error: { message: 'Invalid API Key' } }),
        })
        expect(result).toMatchObject({ ok: false, reason: 'bad_key' })
    })

    it('reports network when the provider cannot be reached', async () => {
        const result = await verifyByokKey({
            provider: 'groq',
            apiKey: USER_KEY,
            fetchFn: (async () => {
                throw new Error('ECONNRESET')
            }) as typeof fetch,
        })
        expect(result).toMatchObject({ ok: false, reason: 'network' })
    })
})
