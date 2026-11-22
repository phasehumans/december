import { MODEL_CATALOG } from './models.ts'
import { DYNAMIC_ENDPOINTS } from './providers/dynamic-registry.ts'
import {
    IBM_IAM_TOKEN_URL,
    parseWatsonxCredential,
    WATSONX_DEFAULT_BASE_URL,
} from './providers/watsonx.ts'

/**
 * One place that decides how december asks a provider "which models can this key use?".
 * The URL comes from the same base url that chat requests use, so the key check and the
 * model list never talk to a different host than the agent does (see issue #619).
 */

export interface ModelOption {
    label: string
    value: string
    /** from the provider's own model list, when it says (G3) */
    contextWindow?: number
}

export type ModelsParser =
    | 'openai'
    | 'google'
    | 'anthropic'
    | 'antigravity'
    | 'openrouter'
    | 'watsonx'

export interface ModelsRequest {
    url: string
    method: 'GET' | 'POST'
    headers: Record<string, string>
    body?: string
    parser: ModelsParser
    /** a cheap authenticated request, for providers whose model list is public */
    keyCheck?: {
        url: string
        headers: Record<string, string>
        method?: 'GET' | 'POST'
        body?: string
    }
    /**
     * false when the list answers any key and there is no free check, so a 200 does not prove
     * the key works (nvidia, sambanova, sarvam, morph, inception, abacus, ai21)
     */
    verifiesKey: boolean
}

/** why a model list could not be read */
export type ModelsFailureReason = 'bad_key' | 'forbidden' | 'no_endpoint' | 'network'

const stripSlash = (url: string) => url.replace(/\/+$/, '')

const bearer = (key: string) => (key.startsWith('Bearer ') ? key : `Bearer ${key}`)

/** no key: ask without auth, for providers whose model list is public */
const bearerAuth = (key: string): Record<string, string> =>
    key ? { Authorization: bearer(key) } : {}

/** providers that have no model list endpoint, so the catalog stays the model list */
const NO_MODELS_ENDPOINT = new Set(['amazon-q', 'amazonq', 'aws', 'codewhisperer'])

/** model lists that answer any key (checked 2026-11-21); no free authenticated GET either */
const LIST_IGNORES_KEY = new Set([
    'abacus',
    'ai21',
    'inception',
    'morph',
    'nvidia',
    'nim',
    'sambanova',
    'sarvam',
    'sarvamai',
    'sarvam-ai',
])

const COPILOT_HEADERS = {
    'Editor-Version': 'vscode/1.95.0',
    'Editor-Plugin-Version': 'copilot/1.240.0',
    'User-Agent': 'GithubCopilot/1.240.0',
}

function isGoogleOAuthToken(key: string): boolean {
    return key.startsWith('ya29.') || key.startsWith('Bearer ')
}

/**
 * Builds the request for a provider's model list, or `null` when the provider has none.
 * `baseUrl` is a user override (custom byok base url or subscription endpoint).
 */
export function resolveModelsRequest(
    provider: string,
    apiKey: string,
    baseUrl?: string
): ModelsRequest | null {
    const request = buildModelsRequest(provider, apiKey, baseUrl)
    if (!request) return null
    const normalized = (provider || '').toLowerCase().trim()
    const canonical = MODEL_CATALOG.aliases[normalized] || normalized
    const ignoresKey =
        !baseUrl && (LIST_IGNORES_KEY.has(normalized) || LIST_IGNORES_KEY.has(canonical))
    return { ...request, verifiesKey: !ignoresKey }
}

function buildModelsRequest(
    provider: string,
    apiKey: string,
    baseUrl?: string
): Omit<ModelsRequest, 'verifiesKey'> | null {
    const normalized = (provider || '').toLowerCase().trim()
    const canonical = MODEL_CATALOG.aliases[normalized] || normalized
    const headers: Record<string, string> = { Accept: 'application/json' }

    if (NO_MODELS_ENDPOINT.has(normalized) || NO_MODELS_ENDPOINT.has(canonical)) return null

    // the gemini subscription is google antigravity: its oauth token cannot read the ai studio
    // model list (403 insufficient scopes), so it asks the antigravity backend instead
    if (normalized === 'antigravity' || (normalized === 'gemini' && isGoogleOAuthToken(apiKey))) {
        return {
            url: 'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
            method: 'POST',
            headers: {
                ...headers,
                ...bearerAuth(apiKey),
                'Content-Type': 'application/json',
                'User-Agent': 'google-antigravity-cli/1.0',
            },
            body: JSON.stringify({ project: 'aicode-consumers' }),
            parser: 'antigravity',
        }
    }

    if (normalized === 'google' || normalized === 'gemini') {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000'
        // AI Studio keys come as `AIza...` and `AQ....`; only real OAuth tokens go in a bearer header
        if (isGoogleOAuthToken(apiKey)) {
            return {
                url,
                method: 'GET',
                headers: { ...headers, ...bearerAuth(apiKey) },
                parser: 'google',
            }
        }
        return {
            url,
            method: 'GET',
            headers: { ...headers, 'x-goog-api-key': apiKey },
            parser: 'google',
        }
    }

    if (normalized === 'anthropic' || normalized === 'claude') {
        const base = baseUrl ? stripSlash(baseUrl) : 'https://api.anthropic.com'
        const url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`
        const isOAuth =
            normalized === 'claude' ||
            apiKey.startsWith('sk-ant-oat') ||
            apiKey.startsWith('Bearer ')
        const authHeaders: Record<string, string> = isOAuth
            ? {
                  ...bearerAuth(apiKey),
                  'anthropic-beta': 'claude-code-20250219,oauth-2024-06-20',
              }
            : { 'x-api-key': apiKey }
        return {
            url: `${url}?limit=1000`,
            method: 'GET',
            headers: { ...headers, 'anthropic-version': '2023-06-01', ...authHeaders },
            parser: 'anthropic',
        }
    }

    if (normalized === 'kimi') {
        // kimi code plan: chat goes to https://api.kimi.com/coding (anthropic protocol)
        return {
            url: 'https://api.kimi.com/coding/v1/models',
            method: 'GET',
            headers: { ...headers, ...bearerAuth(apiKey) },
            parser: 'openai',
        }
    }

    if (normalized === 'openrouter') {
        const auth = { ...headers, ...bearerAuth(apiKey) }
        return {
            url: 'https://openrouter.ai/api/v1/models',
            method: 'GET',
            headers: auth,
            parser: 'openrouter',
            keyCheck: { url: 'https://openrouter.ai/api/v1/key', headers: auth },
        }
    }

    if (normalized === 'huggingface') {
        const auth = { ...headers, ...bearerAuth(apiKey) }
        return {
            url: 'https://router.huggingface.co/v1/models',
            method: 'GET',
            headers: auth,
            parser: 'openai',
            keyCheck: { url: 'https://huggingface.co/api/whoami-v2', headers: auth },
        }
    }

    if (normalized === 'copilot' || normalized === 'github_copilot' || normalized === 'github') {
        const base = baseUrl ? stripSlash(baseUrl) : 'https://api.individual.githubcopilot.com'
        return {
            url: `${base}/models`,
            method: 'GET',
            headers: { ...headers, ...bearerAuth(apiKey), ...COPILOT_HEADERS },
            parser: 'openai',
        }
    }

    if (normalized === 'codex' || normalized === 'chatgpt') {
        // the chatgpt subscription backend has no model list unless a custom base url is set
        if (!baseUrl) return null
        return {
            url: `${stripSlash(baseUrl)}/models`,
            method: 'GET',
            headers: { ...headers, ...bearerAuth(apiKey) },
            parser: 'openai',
        }
    }

    if (canonical === 'watsonx') {
        // the chat model list is public; the iam token exchange is the (free) key check
        const host = (baseUrl || WATSONX_DEFAULT_BASE_URL).replace(/\/ml\/v1\/?$|\/+$/g, '')
        const { apiKey: ibmKey } = parseWatsonxCredential(apiKey)
        return {
            url: `${host}/ml/v1/foundation_model_specs?version=2024-05-01&filters=function_text_chat&limit=200`,
            method: 'GET',
            headers,
            parser: 'watsonx',
            keyCheck: ibmKey
                ? {
                      url: IBM_IAM_TOKEN_URL,
                      method: 'POST',
                      headers: {
                          Accept: 'application/json',
                          'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      body: new URLSearchParams({
                          grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
                          apikey: ibmKey,
                      }).toString(),
                  }
                : undefined,
        }
    }

    if (canonical === 'thinkingmachines') {
        // chat uses the anthropic path, which has no model list; the openai path has one
        return {
            url: 'https://tinker.thinkingmachines.dev/services/tinker-prod/oai/api/v1/models',
            method: 'GET',
            headers: { ...headers, ...bearerAuth(apiKey) },
            parser: 'openai',
        }
    }

    if (normalized === 'perplexity' && !baseUrl) {
        // chat base is https://api.perplexity.ai, the model list is under /v1
        return {
            url: 'https://api.perplexity.ai/v1/models',
            method: 'GET',
            headers: { ...headers, ...bearerAuth(apiKey) },
            parser: 'openai',
        }
    }

    if (normalized === 'novita-ai' && !baseUrl) {
        const auth = { ...headers, ...bearerAuth(apiKey) }
        return {
            url: 'https://api.novita.ai/openai/models',
            method: 'GET',
            headers: auth,
            parser: 'openai',
            keyCheck: {
                url: 'https://api.novita.ai/openapi/v1/billing/balance/detail',
                headers: auth,
            },
        }
    }

    if (normalized === 'cohere') {
        // chat uses the /v2 compatibility base, but the model list lives at /v1/models
        return {
            url: 'https://api.cohere.com/v1/models?endpoint=chat&page_size=1000',
            method: 'GET',
            headers: { ...headers, ...bearerAuth(apiKey) },
            parser: 'openai',
        }
    }

    const authHeaders = { ...headers, ...bearerAuth(apiKey) }

    if (normalized === 'openai') {
        const base = baseUrl ? stripSlash(baseUrl) : 'https://api.openai.com/v1'
        return { url: `${base}/models`, method: 'GET', headers: authHeaders, parser: 'openai' }
    }

    const dynamic = DYNAMIC_ENDPOINTS[normalized] || DYNAMIC_ENDPOINTS[canonical]
    if (baseUrl) {
        const clean = stripSlash(baseUrl)
        const url = dynamic || /\/v\d+(\/|$)/.test(clean) ? `${clean}/models` : `${clean}/v1/models`
        return {
            url,
            method: 'GET',
            headers: { ...authHeaders, ...dynamic?.defaultHeaders },
            parser: 'openai',
        }
    }
    if (dynamic) {
        return {
            url: `${stripSlash(dynamic.baseURL)}/models`,
            method: 'GET',
            headers: { ...authHeaders, ...dynamic.defaultHeaders },
            parser: 'openai',
        }
    }
    return null
}

/** pulls the human readable reason out of a provider's error body */
export function extractProviderMessage(body: string): string | undefined {
    const text = (body || '').trim()
    if (!text) return undefined
    try {
        const json = JSON.parse(text)
        const err = json?.error
        const candidates = [
            err?.message,
            typeof err === 'string' ? err : undefined,
            json?.message,
            json?.detail?.message,
            typeof json?.detail === 'string' ? json.detail : undefined,
            json?.msg,
            json?.error_msg,
        ]
        const found = candidates.find((c) => typeof c === 'string' && c.trim())
        return found ? found.trim() : undefined
    } catch {
        // Intentionally swallowed: body is not json, fall back to plain text below
    }
    if (text.startsWith('<')) return undefined
    return text.slice(0, 300)
}

/** error codes and phrases that mean "this key is not recognised", even with a 400 or 403 */
const BAD_KEY_PATTERN =
    /api_key_invalid|bxnim0415e|api key could not be found|wrong_api_key|invalid_key|invalid[_ -]?api[_ -]?key|incorrect api key|api key not valid|invalid x-api-key|invalid_authentication|authentication_error|unauthenticated|invalid[_ -]?token|token (is )?(invalid|expired)|key (is )?(invalid|expired|revoked)/i

/**
 * Maps a failed model list response to the D4 outcome.
 * 401 (or a bad key code on 400/403): the provider does not know this key.
 * 402/403: the key is known but the account cannot use it (billing, region, restricted).
 * 404/405/501: no model list endpoint here.
 * anything else (429, 5xx): could not verify.
 */
export function classifyModelsFailure(status: number, body: string): ModelsFailureReason {
    if (status === 401) return 'bad_key'
    if ((status === 400 || status === 403) && BAD_KEY_PATTERN.test(body || '')) return 'bad_key'
    if (status === 402 || status === 403) return 'forbidden'
    if (status === 404 || status === 405 || status === 501) return 'no_endpoint'
    return 'network'
}

const NON_CHAT_NAME =
    /embed|bge-|whisper|tts|transcri|speech|audio|-asr\b|orpheus|lyria|rerank|moderation|guard|safety|detector|gliner|nvclip|translate|calibration|robotics|search-api|starcoder|flux|sdxl|stable-diffusion|dall-e|imagen|veo-|image-gen|gpt-image|compaction|-ocr|ocr-|^copilot-search|^exec-agent/i

const NON_CHAT_TYPE =
    /embed|image|video|audio|tts|speech|transcri|asr|rerank|moderation|classif|ocr|3d|music/

/** best effort chat model filter for providers that list every model type */
export function isChatModel(id: string, meta?: any): boolean {
    if (!id || typeof id !== 'string') return false
    if (meta && typeof meta === 'object') {
        // types are free text (stepfun answers in chinese), so reject only clear non-chat types
        const type = [meta.type, meta.model_type].find((t) => typeof t === 'string')?.toLowerCase()
        if (type && NON_CHAT_TYPE.test(type)) return false
        // stepfun
        const protocols = meta.supported_protocols
        if (Array.isArray(protocols) && protocols.length > 0 && !protocols.includes('chat')) {
            return false
        }
        // mistral
        if (meta.capabilities && typeof meta.capabilities.completion_chat === 'boolean') {
            return meta.capabilities.completion_chat
        }
        // cohere (`chat`), novita (`chat/completions`)
        const endpoints = meta.endpoints
        if (
            Array.isArray(endpoints) &&
            endpoints.length > 0 &&
            !endpoints.some((e: unknown) => typeof e === 'string' && e.includes('chat'))
        ) {
            return false
        }
        const output = meta.output_modalities
        if (Array.isArray(output) && output.length > 0 && !output.includes('text')) return false
        // deepinfra: metadata.tags holds chat / image-gen / embed / tts
        const tags = meta.metadata?.tags
        if (Array.isArray(tags) && tags.length > 0 && !tags.includes('chat')) return false
    }
    return !NON_CHAT_NAME.test(id)
}

/** labels openrouter models and puts free ones first */
export function toOpenRouterModelItems(data: any[]): ModelOption[] {
    const models: ModelOption[] = data
        .filter((m: any) => m && typeof m.id === 'string')
        .map((m: any) => {
            const isFree =
                (parseFloat(m.pricing?.prompt) === 0 && parseFloat(m.pricing?.completion) === 0) ||
                m.id.endsWith(':free') ||
                m.name?.toLowerCase().includes('(free)')
            const cleanName = String(m.name || m.id)
                .replace(/\(free\)/gi, '')
                .trim()
            return withContext(
                { label: isFree ? `(free) ${cleanName}` : cleanName, value: m.id },
                readContextWindow(m)
            )
        })
    models.sort((a, b) => {
        const aFree = a.label.startsWith('(free)')
        const bFree = b.label.startsWith('(free)')
        if (aFree !== bFree) return aFree ? -1 : 1
        return a.label.localeCompare(b.label)
    })
    return models
}

/** the context window a provider states in its model list, under any of the names they use */
export function readContextWindow(m: any): number | undefined {
    if (!m || typeof m !== 'object') return undefined
    const candidates = [
        m.context_length,
        m.context_window,
        m.context_size,
        m.max_input_tokens,
        m.max_context_length,
        m.inputTokenLimit,
        m.top_provider?.context_length,
        m.metadata?.context_length,
        m.model_limits?.max_sequence_length,
        m.limits?.max_context_window_tokens,
        m.capabilities?.limits?.max_context_window_tokens,
    ]
    for (const c of candidates) {
        const n = typeof c === 'string' ? Number(c) : c
        if (typeof n === 'number' && Number.isFinite(n) && n >= 1024) return Math.floor(n)
    }
    return undefined
}

const withContext = (option: ModelOption, contextWindow?: number): ModelOption =>
    contextWindow ? { ...option, contextWindow } : option

export function formatModelLabel(id: string): string {
    if (!id) return ''
    const parts = id.split(/[/:]/)
    const last = parts[parts.length - 1]
    return last
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

/** turns a provider's model list json into chat model options */
export function parseModelsResponse(parser: ModelsParser, json: any): ModelOption[] {
    const items: ModelOption[] = []
    if (!json || typeof json !== 'object') return items

    if (parser === 'openrouter') {
        const data = Array.isArray(json.data) ? json.data : []
        const textOnly = data.filter((m: any) => {
            const out = m?.architecture?.output_modalities
            return !Array.isArray(out) || out.includes('text')
        })
        return toOpenRouterModelItems(textOnly)
    }

    if (parser === 'watsonx') {
        for (const m of json.resources || []) {
            if (typeof m?.model_id !== 'string') continue
            items.push(
                withContext(
                    { label: m.label || formatModelLabel(m.model_id), value: m.model_id },
                    readContextWindow(m)
                )
            )
        }
        return items
    }

    if (parser === 'antigravity') {
        for (const [id, m] of Object.entries((json.models || {}) as Record<string, any>)) {
            if (!id || id.startsWith('tab_') || id.startsWith('chat_2')) continue
            if (/image|embedding|tts/.test(id)) continue
            let label = m?.displayName || formatModelLabel(id)
            let value = id
            if (id === 'gemini-3.8-flash-tiered') {
                value = 'gemini-3.8-flash'
                label = 'Gemini 3.8 Flash (High)'
            }
            items.push(withContext({ label, value }, readContextWindow(m)))
        }
        return items
    }

    if (parser === 'google') {
        for (const m of json.models || []) {
            const id = String(m?.name || '').replace(/^models\//, '')
            if (!id) continue
            const methods = m?.supportedGenerationMethods
            if (Array.isArray(methods) && !methods.includes('generateContent')) continue
            if (!(id.includes('gemini') || id.includes('gemma'))) continue
            if (!isChatModel(id)) continue
            if (/image|banana|deep-research|embedding|aqa|tts|live|native-audio/.test(id)) continue
            items.push(
                withContext(
                    { label: m.displayName || formatModelLabel(id), value: id },
                    readContextWindow(m)
                )
            )
        }
        return items
    }

    if (parser === 'anthropic') {
        for (const m of json.data || []) {
            if (m?.id) {
                items.push(
                    withContext(
                        { label: m.display_name || formatModelLabel(m.id), value: m.id },
                        readContextWindow(m)
                    )
                )
            }
        }
        return items
    }

    const list = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.models)
          ? json.models
          : Array.isArray(json)
            ? json
            : []
    for (const m of list) {
        const id = typeof m === 'string' ? m : m?.id || m?.name
        if (!id || typeof id !== 'string') continue
        if (!isChatModel(id, typeof m === 'object' ? m : undefined)) continue
        const label =
            (typeof m === 'object' && (m.display_name || m.displayName)) || formatModelLabel(id)
        items.push(withContext({ label, value: id }, readContextWindow(m)))
    }
    return items
}

/**
 * D5 as a pure function: the catalog default, then the catalog order, then the provider's order.
 * Only models in `available` qualify, and never one of `exclude` (the model that failed).
 */
export function pickPreferredModel(
    provider: string,
    available: string[],
    exclude: string[] = []
): string | undefined {
    const normalized = (provider || '').toLowerCase().trim()
    const canonical = MODEL_CATALOG.aliases[normalized] || normalized
    const entry = MODEL_CATALOG.providers[canonical]
    const excluded = new Set(exclude.map((m) => m.toLowerCase().trim()))
    const usable = available.filter((m) => m && !excluded.has(m.toLowerCase()))
    const byId = new Map(usable.map((m) => [m.toLowerCase(), m]))
    for (const id of [entry?.defaultModel, ...(entry?.models || []).map((m) => m.id)]) {
        const hit = id ? byId.get(id.toLowerCase()) : undefined
        if (hit) return hit
    }
    return usable[0]
}

export type ModelIdsResult =
    | { ok: true; ids: string[]; verified: boolean }
    | { ok: false; reason: ModelsFailureReason; status?: number; message?: string }

/** one uncached read of a provider's chat models, for runs without the cli cache (github action) */
export async function fetchProviderModelIds(
    provider: string,
    apiKey: string,
    baseUrl?: string,
    fetchFn: typeof fetch = fetch
): Promise<ModelIdsResult> {
    const request = resolveModelsRequest(provider, apiKey, baseUrl)
    if (!request) return { ok: false, reason: 'no_endpoint' }
    try {
        if (request.keyCheck) {
            const check = await fetchFn(request.keyCheck.url, {
                method: request.keyCheck.method || 'GET',
                headers: request.keyCheck.headers,
                body: request.keyCheck.body,
                signal: AbortSignal.timeout(8000),
            })
            if (!check.ok) {
                const body = await check.text().catch(() => '')
                const reason = classifyModelsFailure(check.status, body)
                if (reason === 'bad_key' || reason === 'forbidden') {
                    return {
                        ok: false,
                        reason,
                        status: check.status,
                        message: extractProviderMessage(body),
                    }
                }
            }
        }
        const res = await fetchFn(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) {
            const body = await res.text().catch(() => '')
            return {
                ok: false,
                reason: classifyModelsFailure(res.status, body),
                status: res.status,
                message: extractProviderMessage(body),
            }
        }
        const ids = parseModelsResponse(request.parser, await res.json()).map((m) => m.value)
        if (ids.length === 0) return { ok: false, reason: 'no_endpoint', status: res.status }
        return { ok: true, ids, verified: request.verifiesKey }
    } catch (err: any) {
        return { ok: false, reason: 'network', message: err?.message }
    }
}
