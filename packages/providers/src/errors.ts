/**
 * Sorts a provider error into one kind from its http status and the provider's error code,
 * not from loose text matching (issue #619). Each kind gets its own message in the agent.
 */

export type ProviderErrorKind =
    | 'bad_key'
    | 'forbidden'
    | 'no_credits'
    | 'rate_limit'
    | 'model_unavailable'
    | 'endpoint_not_found'
    | 'bad_request'
    | 'overloaded'
    | 'timeout'
    | 'unknown'

export interface ProviderErrorInfo {
    kind: ProviderErrorKind
    status?: number
    /** the provider's own code or type, lowercased (e.g. `model_not_found`, `not_found`) */
    code?: string
    message: string
}

const MODEL_CODES = new Set([
    'model_not_found',
    'model_not_available',
    'model_not_supported',
    'unsupported_model',
    'invalid_model',
    'model_not_exist',
    'model_does_not_exist',
])
const BAD_KEY_CODES = new Set([
    'invalid_api_key',
    'api_key_invalid',
    'authentication_error',
    'invalid_authentication_error',
    'unauthenticated',
    'invalid_authentication',
    'incorrect_api_key',
    'wrong_api_key',
    'invalid_key',
    'invalid_api_key_error',
])
const FORBIDDEN_CODES = new Set([
    'permission_error',
    'permission_denied',
    'permission-denied',
    'unsupported_country_region_territory',
    'forbidden',
])
const NO_CREDIT_CODES = new Set([
    'insufficient_quota',
    'insufficient_balance',
    'insufficient_credits',
    'billing_hard_limit_reached',
    'billing_not_active',
    'payment_required',
    'credit_balance_too_low',
    'insufficient_balance_error',
    'usage_limit_reached',
    'exceeded_current_quota_error',
    'quota_exceeded',
])

/** some providers answer an empty balance with 429 (moonshot, sakana) */
const NO_CREDIT_TEXT =
    /insufficient (balance|credits?|funds|quota)|credit balance|balance is exhausted|suspended due to insufficient|out of credits|add credits|top up/i
const RATE_CODES = new Set(['rate_limit_exceeded', 'rate_limit_error', 'resource_exhausted'])
const OVERLOAD_CODES = new Set(['overloaded_error', 'unavailable', 'service_unavailable'])

/** gateways (one-api / new-api) say "no channel for this model" with these phrases */
const NO_CHANNEL = /无可用渠道|no available channel/i

function parseJson(text: unknown): any {
    if (typeof text !== 'string') return undefined
    const start = text.indexOf('{')
    if (start === -1) return undefined
    try {
        return JSON.parse(text.slice(start))
    } catch {
        // Intentionally swallowed: message is not json
        return undefined
    }
}

function unwrap(error: any): any {
    let current = error
    for (let i = 0; i < 5 && current; i++) {
        if (current.originalError) current = current.originalError
        else break
    }
    return current
}

function firstString(...values: unknown[]): string | undefined {
    for (const v of values) {
        if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return undefined
}

function firstNumber(...values: unknown[]): number | undefined {
    for (const v of values) {
        const n = typeof v === 'string' && /^\d{3}$/.test(v) ? Number(v) : v
        if (typeof n === 'number' && n >= 100 && n < 600) return n
    }
    return undefined
}

/**
 * Reads status, code and message from openai / anthropic / google sdk errors,
 * fetch style errors, and plain errors whose message holds the provider's json body.
 */
export function readProviderError(error: any): { status?: number; code?: string; message: string } {
    const e = unwrap(error)
    if (!e) return { message: 'Unknown error' }
    if (typeof e === 'string') {
        const body = parseJson(e)
        const leading = e.match(/^(\d{3})\b/)
        return {
            status: firstNumber(body?.error?.code, leading?.[1]),
            code: firstString(body?.error?.status, body?.error?.type)?.toLowerCase(),
            message: e,
        }
    }

    const body = e.error ?? e.response?.data ?? parseJson(e.message) ?? parseJson(e.cause?.message)
    const inner = body?.error ?? body
    const message =
        firstString(inner?.message, body?.message, e.message, inner?.detail) || String(e)
    const leading = typeof e.message === 'string' ? e.message.match(/^(\d{3})\b/) : null

    const status = firstNumber(
        e.status,
        e.statusCode,
        e.response?.status,
        e.cause?.status,
        typeof inner?.code === 'number' ? inner.code : undefined,
        leading?.[1]
    )

    const code = firstString(
        typeof e.code === 'string' && !/^E[A-Z]+$/.test(e.code) ? e.code : undefined,
        typeof inner?.code === 'string' ? inner.code : undefined,
        inner?.status,
        inner?.type !== 'error' ? inner?.type : undefined,
        body?.type !== 'error' ? body?.type : undefined,
        e.type
    )?.toLowerCase()

    return { status, code, message }
}

/** a 404 that names a model (or the current model id) is about the model, not the url */
function mentionsModel(message: string, model?: string): boolean {
    const lower = message.toLowerCase()
    if (model && lower.includes(model.toLowerCase())) return true
    return /\bmodels?\b/.test(lower)
}

/** a 400 is about the model only when it says so: "model x does not exist", "invalid model" */
const MODEL_400 =
    /\bmodels?\b[^.\n]{0,60}\b(not exist|does not exist|not found|not supported|no longer supported|unsupported|not available|unavailable|no access|not have access|is invalid)\b|\b(invalid|unknown|unsupported) model\b|not a valid model/i

function isModelBadRequest(message: string, model?: string): boolean {
    if (MODEL_400.test(message)) return true
    // a 400 that names the requested model and says it is missing (sarvam: "should be one of").
    // naming the model alone is not enough: "max_tokens > 64000 for claude-sonnet-5" is a bad request
    if (!model || !message.toLowerCase().includes(model.toLowerCase())) return false
    return /not exist|not found|not supported|unsupported|not available|unavailable|should be one of|unknown|no access|not have access/i.test(
        message
    )
}

export function classifyProviderError(error: any, model?: string): ProviderErrorInfo {
    const { status, code, message } = readProviderError(error)
    const e = unwrap(error)
    const info = (kind: ProviderErrorKind): ProviderErrorInfo => ({ kind, status, code, message })

    if (
        e?.name === 'TimeoutError' ||
        e?.code === 'ETIMEDOUT' ||
        e?.cause?.code === 'ETIMEDOUT' ||
        status === 408 ||
        status === 504
    ) {
        return info('timeout')
    }

    if (code && MODEL_CODES.has(code)) return info('model_unavailable')
    if (code && NO_CREDIT_CODES.has(code)) return info('no_credits')
    if ((status === 429 || status === 402 || status === 403) && NO_CREDIT_TEXT.test(message)) {
        return info('no_credits')
    }
    if (code && BAD_KEY_CODES.has(code)) return info('bad_key')
    if (NO_CHANNEL.test(message)) return info('model_unavailable')

    switch (status) {
        case 401:
            return info('bad_key')
        case 402:
            return info('no_credits')
        case 403:
            return info(code === 'api_key_invalid' ? 'bad_key' : 'forbidden')
        case 404:
            // anthropic: not_found_error "model: x"; google: NOT_FOUND "models/x is not found";
            // openai: model_not_found. A 404 that does not name a model is a wrong base url.
            return info(mentionsModel(message, model) ? 'model_unavailable' : 'endpoint_not_found')
        case 429:
            return info('rate_limit')
        case 500:
        case 502:
        case 503:
        case 529:
            return info('overloaded')
        case 400:
        case 422:
            if (code === 'api_key_invalid' || /api key not valid/i.test(message)) {
                return info('bad_key')
            }
            return info(isModelBadRequest(message, model) ? 'model_unavailable' : 'bad_request')
        default:
            break
    }

    if (code && FORBIDDEN_CODES.has(code)) return info('forbidden')
    if (code && RATE_CODES.has(code)) return info('rate_limit')
    if (code && OVERLOAD_CODES.has(code)) return info('overloaded')
    return info('unknown')
}
