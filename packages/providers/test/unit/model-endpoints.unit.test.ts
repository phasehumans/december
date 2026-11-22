import { describe, expect, it } from 'bun:test'

import {
    classifyModelsFailure,
    fetchProviderModelIds,
    isChatModel,
    parseModelsResponse,
    pickPreferredModel,
    readContextWindow,
    resolveModelsRequest,
} from '../../src/model-endpoints'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('resolveModelsRequest (#619)', () => {
    it('sends ai studio keys (AIza and AQ.) in x-goog-api-key and oauth tokens as bearer', () => {
        for (const key of ['AIzaSyExample', 'AQ.Ab8Example.with.dots']) {
            const r = resolveModelsRequest('google', key)!
            expect(r.headers['x-goog-api-key']).toBe(key)
            expect(r.headers.Authorization).toBeUndefined()
            expect(r.url).not.toContain(key)
        }
        expect(resolveModelsRequest('google', 'ya29.token')!.headers.Authorization).toBe(
            'Bearer ya29.token'
        )
    })

    it('reads the gemini subscription list from the antigravity backend', () => {
        const r = resolveModelsRequest('gemini', 'ya29.token')!
        expect(r.url).toContain('fetchAvailableModels')
        expect(r.method).toBe('POST')
    })

    it('asks the host that chat uses', () => {
        expect(resolveModelsRequest('kimi', 'k')!.url).toBe('https://api.kimi.com/coding/v1/models')
        expect(resolveModelsRequest('moonshot', 'k')!.url).toBe('https://api.moonshot.ai/v1/models')
        expect(resolveModelsRequest('perplexity', 'k')!.url).toBe(
            'https://api.perplexity.ai/v1/models'
        )
        expect(resolveModelsRequest('thinkingmachines', 'k')!.url).toContain('/oai/api/v1/models')
        expect(resolveModelsRequest('hyperbolic', 'k')!.url).toBe(
            'https://api.hyperbolic.ai/inference/v1/models'
        )
        expect(resolveModelsRequest('upstage', 'k')!.url).toBe('https://api.upstage.ai/v1/models')
        expect(resolveModelsRequest('tencent-tokenhub', 'k')!.url).toBe(
            'https://tokenhub.tencentcloudmaas.com/v1/models'
        )
        expect(resolveModelsRequest('cohere', 'k')!.url).toContain('api.cohere.com/v1/models')
    })

    it('uses a custom base url when the user set one', () => {
        expect(resolveModelsRequest('openai', 'k', 'https://proxy.internal/v1/')!.url).toBe(
            'https://proxy.internal/v1/models'
        )
    })

    it('adds a key check for public model lists and marks lists that ignore the key', () => {
        expect(resolveModelsRequest('openrouter', 'k')!.keyCheck?.url).toBe(
            'https://openrouter.ai/api/v1/key'
        )
        expect(resolveModelsRequest('huggingface', 'k')!.keyCheck?.url).toContain('whoami')
        expect(resolveModelsRequest('nvidia', 'k')!.verifiesKey).toBe(false)
        expect(resolveModelsRequest('sambanova', 'k')!.verifiesKey).toBe(false)
        expect(resolveModelsRequest('groq', 'k')!.verifiesKey).toBe(true)
    })

    it('checks watsonx keys with the iam exchange and reads the public chat model list', () => {
        const r = resolveModelsRequest(
            'watsonx',
            'ibm-key-123:0f8fad5b-d9cb-469f-a165-70867728950e'
        )!
        expect(r.url).toContain('/ml/v1/foundation_model_specs')
        expect(r.url).toContain('filters=function_text_chat')
        expect(r.keyCheck?.method).toBe('POST')
        expect(r.keyCheck?.body).toContain('apikey=ibm-key-123')
        expect(r.keyCheck?.body).not.toContain('0f8fad5b')
    })

    it('has no model list for providers without one', () => {
        expect(resolveModelsRequest('amazon-q', 'k')).toBeNull()
        expect(resolveModelsRequest('codex', 'k')).toBeNull()
    })

    it('asks without auth when there is no key', () => {
        expect(resolveModelsRequest('deepinfra', '')!.headers.Authorization).toBeUndefined()
    })
})

describe('classifyModelsFailure (D4)', () => {
    it('separates a bad key from a blocked account', () => {
        expect(classifyModelsFailure(401, '')).toBe('bad_key')
        expect(
            classifyModelsFailure(
                400,
                '{"error":{"status":"INVALID_ARGUMENT","reason":"API_KEY_INVALID"}}'
            )
        ).toBe('bad_key')
        expect(classifyModelsFailure(400, '{"error":"Incorrect API key provided"}')).toBe('bad_key')
        expect(classifyModelsFailure(403, '{"error":"Invalid API Key"}')).toBe('bad_key')
        expect(
            classifyModelsFailure(
                400,
                '{"errorCode":"BXNIM0415E","errorMessage":"Provided API key could not be found."}'
            )
        ).toBe('bad_key')
        expect(
            classifyModelsFailure(403, '{"code":"permission-denied","error":"no credits"}')
        ).toBe('forbidden')
        expect(classifyModelsFailure(402, '{"detail":"billing status"}')).toBe('forbidden')
        expect(classifyModelsFailure(404, 'Not Found')).toBe('no_endpoint')
        expect(classifyModelsFailure(503, 'busy')).toBe('network')
    })
})

describe('isChatModel', () => {
    it('reads each provider type field, in any language', () => {
        expect(
            isChatModel('step-3.5-flash', {
                model_type: '大语言模型',
                supported_protocols: ['chat'],
            })
        ).toBe(true)
        expect(isChatModel('stepaudio-2.5-tts', { supported_protocols: ['audio'] })).toBe(false)
        expect(
            isChatModel('qwen/qwen3', { model_type: 'chat', endpoints: ['chat/completions'] })
        ).toBe(true)
        expect(isChatModel('route-llm-code', { model_type: 'text_generation' })).toBe(true)
        expect(isChatModel('black-forest/flux', { metadata: { tags: ['image-gen'] } })).toBe(false)
        expect(isChatModel('deepseek-v4', { metadata: { tags: ['chat', 'reasoning'] } })).toBe(true)
        expect(isChatModel('mistral-ocr', { capabilities: { completion_chat: false } })).toBe(false)
        expect(isChatModel('x', { type: 'embedding' })).toBe(false)
    })

    it('drops non-chat models by name when there is no type field', () => {
        for (const id of [
            'meta-llama/llama-prompt-guard-2-22m',
            'canopylabs/orpheus-v1-english',
            'mimo-v2.5-asr',
            'bigcode/starcoder2-15b',
            'nvidia/nvclip',
            'text-embedding-3-large',
        ]) {
            expect(isChatModel(id)).toBe(false)
        }
        expect(isChatModel('openai/gpt-oss-120b')).toBe(true)
    })
})

describe('readContextWindow (G3)', () => {
    it('reads the context window under the names providers use', () => {
        expect(readContextWindow({ context_length: 131072 })).toBe(131072)
        expect(readContextWindow({ context_size: 262144 })).toBe(262144)
        expect(readContextWindow({ inputTokenLimit: 1048576 })).toBe(1048576)
        expect(readContextWindow({ max_input_tokens: 262144 })).toBe(262144)
        expect(readContextWindow({ metadata: { context_length: 32768 } })).toBe(32768)
        expect(readContextWindow({ model_limits: { max_sequence_length: 131072 } })).toBe(131072)
        expect(readContextWindow({ context_length: 'n/a' })).toBeUndefined()
        expect(readContextWindow({})).toBeUndefined()
    })

    it('carries it into the parsed model list', () => {
        const watsonx = parseModelsResponse('watsonx', {
            resources: [
                { model_id: 'ibm/granite-4', model_limits: { max_sequence_length: 131072 } },
            ],
        })
        expect(watsonx).toEqual([
            { label: 'Granite 4', value: 'ibm/granite-4', contextWindow: 131072 },
        ])
        const google = parseModelsResponse('google', {
            models: [
                {
                    name: 'models/gemini-3.8-flash',
                    inputTokenLimit: 1048576,
                    supportedGenerationMethods: ['generateContent'],
                },
                {
                    name: 'models/gemini-3.5-transcribe',
                    supportedGenerationMethods: ['generateContent'],
                },
            ],
        })
        expect(google.map((m) => m.value)).toEqual(['gemini-3.8-flash'])
        expect(google[0].contextWindow).toBe(1048576)
    })
})

describe('pickPreferredModel (D5)', () => {
    it('prefers the catalog default, then the catalog order, then the provider order', () => {
        expect(pickPreferredModel('anthropic', ['brand-new', 'claude-opus-5'])).toBe(
            'claude-opus-5'
        )
        expect(
            pickPreferredModel('anthropic', ['brand-new', 'claude-opus-5'], ['claude-opus-5'])
        ).toBe('brand-new')
        expect(pickPreferredModel('anthropic', ['only'], ['only'])).toBeUndefined()
    })
})

describe('fetchProviderModelIds', () => {
    it('returns the ids, or why there are none', async () => {
        const ok = await fetchProviderModelIds('groq', 'k', undefined, (async () =>
            json({ data: [{ id: 'openai/gpt-oss-120b' }, { id: 'whisper-large-v3' }] })) as any)
        expect(ok).toEqual({ ok: true, ids: ['openai/gpt-oss-120b'], verified: true })

        const bad = await fetchProviderModelIds('groq', 'k', undefined, (async () =>
            json({ error: { message: 'Invalid API Key' } }, 401)) as any)
        expect(bad.ok === false && bad.reason).toBe('bad_key')
    })

    it('runs the watsonx key check as a POST to ibm iam', async () => {
        const calls: { url: string; method?: string }[] = []
        await fetchProviderModelIds('watsonx', 'bad-ibm-key', undefined, (async (
            url: string,
            init: any
        ) => {
            calls.push({ url, method: init?.method })
            return json(
                { errorCode: 'BXNIM0415E', errorMessage: 'Provided API key could not be found.' },
                400
            )
        }) as any)
        expect(calls[0]).toEqual({
            url: 'https://iam.cloud.ibm.com/identity/token',
            method: 'POST',
        })
    })
})
