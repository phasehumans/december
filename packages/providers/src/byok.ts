/**
 * Own keys (bring your own key) for hosted runs, such as december cloud.
 *
 * The cli builds its clients in apps/cli/src/utils/provider-factory.ts and reads the
 * provider list from packages/tui. This module repeats that mapping for servers, with
 * one rule the cli does not need: a hosted client must never fall back to the
 * server's own env keys. Every factory here falls back to process.env only when the
 * key is empty, so a non-empty key is required before any factory is called. The sdk
 * clients also read env on their own (OPENAI_BASE_URL, OPENAI_ORG_ID, ANTHROPIC_BASE_URL,
 * ANTHROPIC_AUTH_TOKEN, GOOGLE_GENAI_USE_VERTEXAI), so this module builds them itself with
 * every one of those options set.
 */
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'

import { classifyProviderError } from './errors.ts'
import { fetchProviderModelIds, pickPreferredModel } from './model-endpoints.ts'
import { anthropicProvider } from './providers/anthropic.ts'
import { getDynamicEndpoint } from './providers/dynamic-registry.ts'
import { geminiProvider } from './providers/gemini.ts'
import { openaiProvider, providerFetch } from './providers/openai.ts'
import { openrouterProvider } from './providers/openrouter.ts'
import { watsonxProvider } from './providers/watsonx.ts'

import type { LLMProvider } from './types.ts'

export interface ByokProviderInfo {
    id: string
    name: string
    keyUrl: string
    keyHint?: string
}

// Same ids, names and key pages as PROVIDER_MENU_ITEMS and PROVIDER_KEY_URLS in
// packages/tui/src/constants/providers.ts. apps/cli/test/unit/byok-parity.unit.test.ts
// fails when the two lists drift apart.
export const BYOK_PROVIDERS: readonly ByokProviderInfo[] = [
    { id: 'abacus', name: 'Abacus', keyUrl: 'https://abacus.ai/app/route-llm-apis' },
    { id: 'ai21', name: 'AI21 Labs', keyUrl: 'https://studio.ai21.com/v2' },
    { id: 'anthropic', name: 'Anthropic', keyUrl: 'https://platform.claude.com/settings/keys' },
    { id: 'arcee', name: 'Arcee AI', keyUrl: 'https://platform.arcee.ai/api/api-keys' },
    { id: 'cerebras', name: 'Cerebras', keyUrl: 'https://cloud.cerebras.ai' },
    { id: 'cohere', name: 'Cohere', keyUrl: 'https://dashboard.cohere.com/api-keys' },
    { id: 'deepinfra', name: 'Deep Infra', keyUrl: 'https://deepinfra.com/dash/keys' },
    { id: 'deepseek', name: 'DeepSeek', keyUrl: 'https://platform.deepseek.com/api_keys' },
    {
        id: 'fireworks',
        name: 'Fireworks AI',
        keyUrl: 'https://app.fireworks.ai/settings/users/api-keys',
    },
    { id: 'google', name: 'Google AI Studio', keyUrl: 'https://aistudio.google.com/api-keys' },
    { id: 'groq', name: 'Groq', keyUrl: 'https://console.groq.com/keys' },
    { id: 'huggingface', name: 'Hugging Face', keyUrl: 'https://huggingface.co/settings/tokens' },
    {
        id: 'hyperbolic',
        name: 'Hyperbolic',
        keyUrl: 'https://app.hyperbolic.ai/settings/api-keys',
    },
    {
        id: 'inception',
        name: 'Inception',
        keyUrl: 'https://platform.inceptionlabs.ai/dashboard/api-keys',
    },
    { id: 'kimi', name: 'Kimi', keyUrl: 'https://www.kimi.com/code/console' },
    { id: 'meta', name: 'Meta', keyUrl: 'https://dev.meta.ai/' },
    {
        id: 'minimax',
        name: 'MiniMax',
        keyUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key',
    },
    { id: 'mistral', name: 'Mistral AI', keyUrl: 'https://console.mistral.ai/api-keys' },
    { id: 'moonshot', name: 'Moonshot AI', keyUrl: 'https://platform.kimi.ai/console/api-keys' },
    { id: 'morph', name: 'Morph', keyUrl: 'https://morphllm.com/dashboard/api-keys' },
    {
        id: 'nebius',
        name: 'Nebius Token Factory',
        keyUrl: 'https://tokenfactory.nebius.com/project/api-keys',
    },
    { id: 'novita-ai', name: 'NovitaAI', keyUrl: 'https://novita.ai/settings/key-management' },
    { id: 'nvidia', name: 'NVIDIA NIM', keyUrl: 'https://build.nvidia.com/settings/api-keys' },
    { id: 'openai', name: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys' },
    { id: 'openrouter', name: 'OpenRouter', keyUrl: 'https://openrouter.ai/settings/keys' },
    {
        id: 'perplexity',
        name: 'Perplexity AI',
        keyUrl: 'https://console.perplexity.ai/project/keys',
    },
    {
        id: 'dashscope',
        name: 'Qwen (DashScope)',
        keyUrl: 'https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key',
    },
    { id: 'sakana', name: 'Sakana AI', keyUrl: 'https://console.sakana.ai/api-keys' },
    { id: 'sambanova', name: 'SambaNova Cloud', keyUrl: 'https://cloud.sambanova.ai/apis' },
    { id: 'sarvam', name: 'Sarvam AI', keyUrl: 'https://indus.sarvam.ai/key-management' },
    { id: 'siliconflow', name: 'SiliconFlow', keyUrl: 'https://cloud.siliconflow.cn/account/ak' },
    {
        id: 'stepfun',
        name: 'StepFun (Global)',
        keyUrl: 'https://platform.stepfun.ai/interface-key',
    },
    {
        id: 'tencent-tokenhub',
        name: 'Tencent TokenHub',
        keyUrl: 'https://console.cloud.tencent.com/tokenhub/apikey',
    },
    {
        id: 'thinkingmachines',
        name: 'Thinking Machines (Tinker)',
        keyUrl: 'https://tinker.thinkingmachines.ai/keys',
    },
    {
        id: 'together',
        name: 'Together AI',
        keyUrl: 'https://api.together.ai/settings/projects/~current/api-keys',
    },
    { id: 'upstage', name: 'Upstage Solar', keyUrl: 'https://console.upstage.ai/api-keys' },
    {
        id: 'volcengine',
        name: 'Volcengine Ark',
        keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    },
    { id: 'wafer.ai', name: 'Wafer', keyUrl: 'https://app.wafer.ai' },
    {
        id: 'watsonx',
        name: 'watsonx.ai',
        keyUrl: 'https://cloud.ibm.com/iam/apikeys',
        keyHint: 'Enter it as API_KEY:PROJECT_ID',
    },
    { id: 'xai', name: 'xAI', keyUrl: 'https://console.x.ai/team/default/api-keys' },
    {
        id: 'xiaomi',
        name: 'Xiaomi',
        keyUrl: 'https://platform.xiaomimimo.com/#/console/api-keys',
    },
    { id: 'zai', name: 'ZAI', keyUrl: 'https://z.ai/manage-apikey/apikey-list' },
]

const BYOK_PROVIDER_IDS = new Set(BYOK_PROVIDERS.map((p) => p.id))

export const isByokProvider = (provider: string): boolean => BYOK_PROVIDER_IDS.has(provider)

export type ByokErrorCode =
    | 'missing_key'
    | 'unknown_provider'
    | 'plan_token_not_allowed'
    | 'missing_project_id'

export class ByokError extends Error {
    readonly code: ByokErrorCode

    constructor(code: ByokErrorCode, message: string) {
        super(message)
        this.name = 'ByokError'
        this.code = code
    }
}

const WATSONX_KEY = /^[^:\s]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TINKER_ANTHROPIC_URL =
    'https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api'
const KIMI_ANTHROPIC_URL = 'https://api.kimi.com/coding'

const OPENAI_URL = 'https://api.openai.com/v1'
const ANTHROPIC_URL = 'https://api.anthropic.com'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1'
const OPENROUTER_HEADERS = { 'HTTP-Referer': 'https://trydecember.com', 'X-Title': 'December' }

const withId = (provider: LLMProvider, id: string): LLMProvider => ({ ...provider, id })

const openAiCompatible = (
    baseURL: string,
    key: string,
    headers?: Record<string, string>
): LLMProvider =>
    openaiProvider(
        baseURL,
        key,
        headers,
        new OpenAI({
            baseURL,
            apiKey: key,
            organization: null,
            project: null,
            ...(headers ? { defaultHeaders: headers } : {}),
            fetch: providerFetch,
            maxRetries: 0,
        })
    )

const anthropicCompatible = (data: {
    baseURL: string
    key: string
    oauth?: boolean
    headers?: Record<string, string>
}): LLMProvider => {
    const { baseURL, key, oauth = false, headers } = data
    const client = new Anthropic({
        baseURL,
        apiKey: oauth ? null : key,
        authToken: oauth ? key : null,
        defaultHeaders: {
            ...(oauth ? { 'anthropic-beta': 'claude-code-20250219,oauth-2024-06-20' } : {}),
            ...(headers || {}),
        },
    })
    return anthropicProvider(baseURL, key, headers, client)
}

/**
 * Checks the key shape and returns the trimmed key. Throws ByokError when the key is
 * empty, the provider is not a byok provider, the key is a claude plan token (oauth),
 * or a watsonx key has no project id (watsonx would read WATSONX_PROJECT_ID from env).
 */
export const normalizeByokKey = (data: { provider: string; apiKey: string }): string => {
    const { provider, apiKey } = data
    if (!isByokProvider(provider)) {
        throw new ByokError('unknown_provider', `${provider} is not a supported provider`)
    }
    const key = (apiKey ?? '').trim()
    if (!key) throw new ByokError('missing_key', 'Enter an API key')
    if (provider === 'anthropic' && (key.startsWith('sk-ant-oat') || key.startsWith('Bearer '))) {
        throw new ByokError(
            'plan_token_not_allowed',
            'This is a Claude plan token. Use an API key from the Claude Console.'
        )
    }
    if (provider === 'watsonx' && !WATSONX_KEY.test(key)) {
        throw new ByokError('missing_project_id', 'Enter the key as API_KEY:PROJECT_ID')
    }
    return key
}

/**
 * Builds a client for a user's own key. Mirrors the byok cases of the cli
 * instantiateProvider, without its env fallbacks.
 */
export const createByokProvider = (data: { provider: string; apiKey: string }): LLMProvider => {
    const { provider } = data
    const key = normalizeByokKey(data)

    switch (provider) {
        case 'openai':
            return openAiCompatible(OPENAI_URL, key)
        case 'anthropic':
            return anthropicCompatible({ baseURL: ANTHROPIC_URL, key })
        case 'google':
            return withId(
                geminiProvider(key, new GoogleGenAI({ apiKey: key, vertexai: false })),
                'google'
            )
        case 'openrouter':
            return openrouterProvider(
                key,
                openAiCompatible(OPENROUTER_URL, key, OPENROUTER_HEADERS)
            )
        case 'kimi':
            return withId(anthropicCompatible({ baseURL: KIMI_ANTHROPIC_URL, key }), 'kimi')
        case 'thinkingmachines':
            return withId(
                anthropicCompatible({
                    baseURL: TINKER_ANTHROPIC_URL,
                    key,
                    oauth: true,
                    headers: { 'anthropic-beta': 'oauth-2024-11-18' },
                }),
                'thinkingmachines'
            )
        case 'watsonx':
            return watsonxProvider(key, undefined, fetch, (base, token) =>
                openAiCompatible(base, token)
            )
        default: {
            const endpoint = getDynamicEndpoint(provider)
            if (!endpoint) {
                throw new ByokError('unknown_provider', `${provider} is not a supported provider`)
            }
            return withId(
                openAiCompatible(endpoint.baseURL, key, endpoint.defaultHeaders),
                provider
            )
        }
    }
}

export type ByokVerifyFailure = 'bad_key' | 'forbidden' | 'no_credits' | 'no_endpoint' | 'network'

export type ByokVerifyResult =
    | { ok: true; models: string[]; defaultModel: string }
    | { ok: false; reason: ByokVerifyFailure; message?: string }

// a 1-token request proves the key when the provider's model list does not need one
const confirmWithCompletion = async (data: {
    provider: string
    apiKey: string
    model: string
}): Promise<ByokVerifyResult | null> => {
    const { provider, apiKey, model } = data
    try {
        const client = createByokProvider({ provider, apiKey })
        const stream = client.stream(
            [{ role: 'user', content: 'Reply with OK.' }],
            undefined,
            undefined,
            { model, max_tokens: 1 },
            AbortSignal.timeout(15000)
        )
        for await (const chunk of stream) {
            if (chunk) break
        }
        return null
    } catch (error) {
        const info = classifyProviderError(error, model)
        if (info.kind === 'bad_key') return { ok: false, reason: 'bad_key', message: info.message }
        if (info.kind === 'no_credits') {
            return { ok: false, reason: 'no_credits', message: info.message }
        }
        if (info.kind === 'forbidden') {
            return { ok: false, reason: 'forbidden', message: info.message }
        }
        return { ok: false, reason: 'network', message: info.message }
    }
}

/**
 * Checks a key before it is saved: lists the models the key can use, and for
 * providers whose list does not check the key, sends one 1-token request.
 */
export const verifyByokKey = async (data: {
    provider: string
    apiKey: string
    fetchFn?: typeof fetch
}): Promise<ByokVerifyResult> => {
    const { provider, fetchFn = fetch } = data
    const apiKey = normalizeByokKey(data)

    const listed = await fetchProviderModelIds(provider, apiKey, undefined, fetchFn)
    if (listed.ok === false) {
        const failure = listed as Extract<typeof listed, { ok: false }>
        return {
            ok: false,
            reason: failure.reason,
            ...(failure.message ? { message: failure.message } : {}),
        }
    }

    const defaultModel = pickPreferredModel(provider, listed.ids) ?? listed.ids[0]
    if (!defaultModel) return { ok: false, reason: 'no_endpoint' }

    if (!listed.verified) {
        const failure = await confirmWithCompletion({ provider, apiKey, model: defaultModel })
        if (failure) return failure
    }

    return { ok: true, models: listed.ids, defaultModel }
}
