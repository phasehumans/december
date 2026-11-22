import { createHash } from 'node:crypto'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
    classifyModelsFailure,
    extractProviderMessage,
    getModelContextWindow as getCatalogContextWindow,
    MODEL_CATALOG,
    parseModelsResponse,
    pickPreferredModel,
    resolveModelsRequest,
} from '@december/providers'

import type { ModelOption, ModelsFailureReason } from '@december/providers'

export const LIVE_MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const MODELS_TIMEOUT_MS = 8000

export interface LiveModelCacheEntry {
    timestamp: number
    models: ModelOption[]
    unavailable?: string[]
}

const liveModelCache = new Map<string, LiveModelCacheEntry>()
let diskCacheLoaded = false

function getModelsCacheFile(): string {
    if (process.env.DECEMBER_CONFIG_DIR) {
        return path.join(process.env.DECEMBER_CONFIG_DIR, 'models-cache.json')
    }
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
    const canonicalFile = path.join(home, '.december', 'models-cache.json')
    const legacyFile = path.join(home, '.config', 'december', 'models-cache.json')
    if (existsSync(canonicalFile) || !existsSync(legacyFile)) {
        return canonicalFile
    }
    return legacyFile
}

/** `<provider>:<16 hex fingerprint | default>:<base url>`; anything else holds a raw key */
function isFingerprintCacheKey(key: string): boolean {
    const second = key.split(':')[1] || ''
    return second === 'default' || /^[0-9a-f]{16}$/.test(second)
}

export function initDiskCacheSync(): void {
    if (diskCacheLoaded) return
    diskCacheLoaded = true
    const isTestEnv =
        process.env.NODE_ENV === 'test' || !!process.env.BUN_TEST || !!process.env.VITEST
    if (isTestEnv && !process.env.DECEMBER_TEST_LOAD_CACHE) return
    try {
        const cacheFile = getModelsCacheFile()
        if (existsSync(cacheFile)) {
            const raw = readFileSync(cacheFile, 'utf-8')
            const parsed = JSON.parse(raw)
            const now = Date.now()
            let droppedRawKeys = false
            for (const [k, v] of Object.entries(parsed as Record<string, LiveModelCacheEntry>)) {
                // older versions keyed the cache by the raw api key: drop those entries
                if (!isFingerprintCacheKey(k)) {
                    droppedRawKeys = true
                    continue
                }
                if (
                    v &&
                    typeof v.timestamp === 'number' &&
                    Array.isArray(v.models) &&
                    now - v.timestamp < LIVE_MODEL_CACHE_TTL_MS
                ) {
                    liveModelCache.set(k, v)
                }
            }
            if (droppedRawKeys) {
                saveDiskCache().catch(() => {
                    // Intentionally swallowed: the next save rewrites the file anyway
                })
            }
        }
    } catch {
        // Intentionally swallowed: ignore cache read errors
    }
}

export async function saveDiskCache(): Promise<void> {
    try {
        const cacheFile = getModelsCacheFile()
        const dir = path.dirname(cacheFile)
        await fs.mkdir(dir, { recursive: true }).catch(() => {})
        const obj: Record<string, LiveModelCacheEntry> = {}
        const now = Date.now()
        for (const [k, v] of liveModelCache.entries()) {
            if (now - v.timestamp < LIVE_MODEL_CACHE_TTL_MS) {
                obj[k] = v
            }
        }
        await fs.writeFile(cacheFile, JSON.stringify(obj, null, 2), 'utf-8')
    } catch {
        // Intentionally swallowed: ignore cache write errors
    }
}

export function clearProviderModelsCache(provider?: string): void {
    if (provider) {
        const prefix = `${provider.toLowerCase().trim()}:`
        for (const key of liveModelCache.keys()) {
            if (key.startsWith(prefix)) {
                liveModelCache.delete(key)
            }
        }
        saveDiskCache().catch(() => {})
    } else {
        liveModelCache.clear()
        diskCacheLoaded = false
        try {
            const cacheFile = getModelsCacheFile()
            if (existsSync(cacheFile)) {
                unlinkSync(cacheFile)
            }
        } catch {
            // Intentionally swallowed: ignore cache deletion errors
        }
    }
}

export function markModelUnavailable(provider: string, model: string): void {
    const normalized = (provider || '').toLowerCase().trim()
    const lowerModel = (model || '').toLowerCase().trim()
    if (!lowerModel) return

    initDiskCacheSync()

    let modified = false
    for (const [key, entry] of liveModelCache.entries()) {
        if (key.startsWith(`${normalized}:`)) {
            const beforeLen = entry.models.length
            entry.models = entry.models.filter((m) => m.value.toLowerCase().trim() !== lowerModel)
            entry.unavailable = entry.unavailable || []
            if (!entry.unavailable.includes(lowerModel)) {
                entry.unavailable.push(lowerModel)
                modified = true
            }
            if (entry.models.length !== beforeLen) {
                modified = true
            }
        }
    }

    if (!modified) {
        const cacheKey = `${normalized}:default:default`
        const curated = getCuratedProviderModels(normalized).filter(
            (m) => m.value.toLowerCase().trim() !== lowerModel
        )
        liveModelCache.set(cacheKey, {
            timestamp: Date.now(),
            models: curated,
            unavailable: [lowerModel],
        })
    }

    saveDiskCache().catch(() => {
        // Intentionally swallowed: ignore cache write errors
    })
}

export const getCuratedProviderModels = (provider: string): { label: string; value: string }[] => {
    const normalized = (provider || '').toLowerCase().trim()
    const canonical = MODEL_CATALOG.aliases[normalized] || normalized

    const entry = MODEL_CATALOG.providers[canonical]
    if (entry && Array.isArray(entry.models) && entry.models.length > 0) {
        return entry.models.map((m) => ({ label: m.label, value: m.id }))
    }
    return [{ label: 'Default', value: 'default' }]
}

export const getProviderModels = (provider: string) => {
    const normalized = (provider || '').toLowerCase().trim()
    initDiskCacheSync()
    const now = Date.now()
    for (const [key, entry] of liveModelCache.entries()) {
        if (key.startsWith(`${normalized}:`) && now - entry.timestamp < LIVE_MODEL_CACHE_TTL_MS) {
            const unavail = new Set((entry.unavailable || []).map((m) => m.toLowerCase()))
            return entry.models.filter((m) => !unavail.has(m.value.toLowerCase()))
        }
    }
    const curated = getCuratedProviderModels(normalized)
    for (const [key, entry] of liveModelCache.entries()) {
        if (key.startsWith(`${normalized}:`) && entry.unavailable && entry.unavailable.length > 0) {
            const unavail = new Set(entry.unavailable.map((m) => m.toLowerCase()))
            return curated.filter((m) => !unavail.has(m.value.toLowerCase()))
        }
    }
    return curated
}

export type LiveModelsFailureReason = ModelsFailureReason | 'no_key'

export type LiveModelsResult =
    /** verified: false when the list answers any key, so the key itself is still unchecked */
    | { ok: true; models: ModelOption[]; verified: boolean }
    | { ok: false; reason: LiveModelsFailureReason; status?: number; message?: string }

const keyFingerprint = (apiKey: string): string =>
    createHash('sha256').update(apiKey).digest('hex').slice(0, 16)

const liveCacheKey = (provider: string, apiKey: string, baseUrl?: string): string =>
    `${provider}:${keyFingerprint(apiKey)}:${baseUrl || 'default'}`

/**
 * D1: the provider decides which models appear, the catalog decides their order and labels.
 * Catalog models come first in catalog order, then the rest in the provider's order.
 */
export function orderByCatalog(provider: string, live: ModelOption[]): ModelOption[] {
    const normalized = (provider || '').toLowerCase().trim()
    const canonical = MODEL_CATALOG.aliases[normalized] || normalized
    const catalogModels = MODEL_CATALOG.providers[canonical]?.models || []
    const liveById = new Map(live.map((m) => [m.value.toLowerCase(), m]))
    const seen = new Set<string>()
    const ordered: ModelOption[] = []
    for (const cm of catalogModels) {
        const hit = liveById.get(cm.id.toLowerCase())
        if (hit && !seen.has(hit.value)) {
            seen.add(hit.value)
            ordered.push({ ...hit, label: cm.label || hit.label })
        }
    }
    for (const m of live) {
        if (!seen.has(m.value)) {
            seen.add(m.value)
            ordered.push(m)
        }
    }
    return ordered
}

async function readModelsResponse(
    res: Response
): Promise<{ ok: true; json: any } | { ok: false; status: number; body: string }> {
    if (res.ok) {
        return { ok: true, json: await res.json() }
    }
    const body = await res.text().catch(() => '')
    return { ok: false, status: res.status, body }
}

/**
 * Asks the provider which models this key can use.
 * Returns the failure type (bad key, forbidden, no endpoint, network) instead of a fallback list,
 * so callers can tell "bad key" from "this provider has no model list".
 */
export async function fetchLiveProviderModels(
    provider: string,
    apiKey?: string,
    baseUrl?: string,
    fetchFn: typeof fetch = fetch
): Promise<LiveModelsResult> {
    const normalized = (provider || '').toLowerCase().trim()

    if (normalized === 'december' || normalized === 'december_proxy') {
        return { ok: true, models: getCuratedProviderModels(normalized), verified: true }
    }

    if (!apiKey) {
        return { ok: false, reason: 'no_key' }
    }

    const cacheKey = liveCacheKey(normalized, apiKey, baseUrl)
    const request = resolveModelsRequest(normalized, apiKey, baseUrl)
    const cached = liveModelCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < LIVE_MODEL_CACHE_TTL_MS) {
        return { ok: true, models: cached.models, verified: request?.verifiesKey ?? true }
    }

    if (!request) {
        return { ok: false, reason: 'no_endpoint' }
    }

    try {
        if (request.keyCheck) {
            const check = await fetchFn(request.keyCheck.url, {
                method: request.keyCheck.method || 'GET',
                headers: request.keyCheck.headers,
                body: request.keyCheck.body,
                signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
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
            signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
        })
        const read = await readModelsResponse(res)
        if (read.ok === false) {
            return {
                ok: false,
                reason: classifyModelsFailure(read.status, read.body),
                status: read.status,
                message: extractProviderMessage(read.body),
            }
        }

        const live = parseModelsResponse(request.parser, read.json)
        if (live.length === 0) {
            return { ok: false, reason: 'no_endpoint', status: res.status }
        }

        const models = orderByCatalog(normalized, live)
        liveModelCache.set(cacheKey, { timestamp: Date.now(), models })
        saveDiskCache().catch(() => {
            // Intentionally swallowed: cache write failure only costs a refetch
        })
        return { ok: true, models, verified: request.verifiesKey }
    } catch (err: any) {
        return { ok: false, reason: 'network', message: err?.message }
    }
}

export type KeyCheckResult =
    | { status: 'valid'; models: ModelOption[] }
    | { status: 'rejected' | 'forbidden'; message?: string; httpStatus?: number }
    | { status: 'unverified'; reason: LiveModelsFailureReason; message?: string }

/**
 * D4: checks a key with the provider's model list before december saves it.
 * rejected: do not save. forbidden: save and show the provider's reason.
 * unverified: save, december checks again on the first message.
 */
export async function checkProviderKey(
    provider: string,
    apiKey: string,
    baseUrl?: string,
    fetchFn: typeof fetch = fetch
): Promise<KeyCheckResult> {
    const normalized = (provider || '').toLowerCase().trim()
    const keep = liveCacheKey(normalized, apiKey, baseUrl)
    // a fresh check: never answer from a cached list
    liveModelCache.delete(keep)

    const result = await fetchLiveProviderModels(normalized, apiKey, baseUrl, fetchFn)
    if (result.ok === false && result.reason === 'bad_key') {
        return { status: 'rejected', message: result.message, httpStatus: result.status }
    }

    // the key will be saved: drop lists read with any older key for this provider
    for (const key of [...liveModelCache.keys()]) {
        if (key.startsWith(`${normalized}:`) && key !== keep) liveModelCache.delete(key)
    }
    saveDiskCache().catch(() => {
        // Intentionally swallowed: cache write failure only costs a refetch
    })

    if (result.ok === true) {
        if (result.verified) return { status: 'valid', models: result.models }
        return { status: 'unverified', reason: 'no_endpoint' }
    }
    if (result.reason === 'forbidden') {
        return { status: 'forbidden', message: result.message, httpStatus: result.status }
    }
    return { status: 'unverified', reason: result.reason, message: result.message }
}

/** the cached live list for a provider, or undefined when december has not read one yet */
export const getLiveProviderModels = (provider: string): ModelOption[] | undefined => {
    const normalized = (provider || '').toLowerCase().trim()
    initDiskCacheSync()
    const now = Date.now()
    for (const [key, entry] of liveModelCache.entries()) {
        if (key.startsWith(`${normalized}:`) && now - entry.timestamp < LIVE_MODEL_CACHE_TTL_MS) {
            // `<provider>:default:default` holds the curated list minus failed models, not a live list
            if (key.split(':')[1] === 'default') continue
            const unavail = new Set((entry.unavailable || []).map((m) => m.toLowerCase()))
            return entry.models.filter((m) => !unavail.has(m.value.toLowerCase()))
        }
    }
    return undefined
}

export const getModelLabel = (value: string) => {
    const allProviders = [
        'anthropic',
        'google',
        'openai',
        'openrouter',
        'deepseek',
        'groq',
        'huggingface',
        'kimi',
        'moonshot',
        'mistral',
        'xai',
        'xiaomi',
        'zai',
        'nvidia',
        'sambanova',
        'cerebras',
        'siliconflow',
        'together',
        'hyperbolic',
        'fireworks',
        'perplexity',
        'cohere',
        'copilot',
        'claude',
        'codex',
        'minimax',
        'dashscope',
        'arcee',
        'meta',
        'sakana',
        'sarvam',
        'stepfun',
        'upstage',
        'thinkingmachines',
        'abacus',
        'ai21',
        'deepinfra',
        'inception',
        'morph',
        'nebius',
        'novita-ai',
        'tencent-tokenhub',
        'volcengine',
        'wafer.ai',
        'watsonx',
        'amazon-q',
        'december_proxy',
    ]
    for (const p of allProviders) {
        const models = getProviderModels(p)
        const found = models.find((m) => m.value === value)
        if (found) return found.label
    }
    return value
}

export const isValidModelForProvider = (provider: string, model?: string): boolean => {
    if (!model) return false
    const normalized = (provider || '').toLowerCase().trim()
    if (normalized === 'december' || normalized === 'december_proxy') {
        return model.toLowerCase() === 'december-auto'
    }

    const canonical = MODEL_CATALOG.aliases[normalized] || normalized

    // once the provider has told us its models, that list is the only truth
    const live = getLiveProviderModels(normalized)
    if (live && live.length > 0) {
        const wanted = model.toLowerCase().trim()
        return live.some((m) => m.value.toLowerCase() === wanted)
    }

    if (normalized === 'openrouter' && (model.includes('/') || model.includes(':'))) return true
    if (
        (canonical === 'kimi' ||
            canonical === 'moonshot' ||
            normalized === 'kimi-code-plan' ||
            normalized === 'kimi-code' ||
            normalized === 'kimi-code-plan-cn' ||
            normalized === 'kimi-code-plan-global' ||
            normalized === 'moonshot-code-plan') &&
        (model.includes('/') ||
            model.startsWith('kimi') ||
            model.startsWith('k3') ||
            model.startsWith('moonshot') ||
            model === 'k3')
    )
        return true
    if (canonical === 'arcee' && (model.includes('/') || model.includes(':'))) return true
    if (
        canonical === 'meta' &&
        (model.includes('/') || model.includes(':') || model.startsWith('llama'))
    )
        return true
    if (
        (canonical === 'xiaomi' || normalized === 'mimo') &&
        (model.includes('/') || model.startsWith('mimo'))
    )
        return true
    if (
        (canonical === 'zai' || normalized === 'zhipu' || normalized === 'zhipuai') &&
        (model.includes('/') || model.startsWith('glm'))
    )
        return true
    if (
        canonical === 'sakana' &&
        (model.includes('/') || model.startsWith('fugu') || model.startsWith('sakana'))
    )
        return true
    if (
        (canonical === 'thinkingmachines' || normalized === 'tinker' || normalized === 'inkling') &&
        (model.includes('/') ||
            model.startsWith('inkling') ||
            model.startsWith('trinity') ||
            model.startsWith('thinkingmachines'))
    )
        return true
    if (
        canonical === 'anthropic' &&
        (model.startsWith('claude') ||
            model.includes('sonnet') ||
            model.includes('opus') ||
            model.includes('haiku'))
    )
        return true
    if (
        canonical === 'openai' &&
        (model.startsWith('gpt') ||
            model.startsWith('o1') ||
            model.startsWith('o3') ||
            model.startsWith('o4'))
    )
        return true
    if (
        (canonical === 'google' || canonical === 'antigravity') &&
        (model.startsWith('gemini') ||
            model.startsWith('gemma') ||
            model.startsWith('claude') ||
            model.startsWith('gpt-oss'))
    )
        return true
    if (canonical === 'deepseek' && model.startsWith('deepseek')) return true
    if (
        canonical === 'groq' &&
        (model.startsWith('llama') ||
            model.startsWith('qwen') ||
            model.startsWith('deepseek') ||
            model.startsWith('mixtral'))
    )
        return true
    if (
        canonical === 'mistral' &&
        (model.startsWith('mistral') ||
            model.startsWith('codestral') ||
            model.startsWith('pixtral') ||
            model.startsWith('ministral'))
    )
        return true
    if (canonical === 'xai' && model.startsWith('grok')) return true
    if (canonical === 'dashscope' && (model.startsWith('qwen') || model.includes('qwen')))
        return true
    if (canonical === 'minimax' && (model.startsWith('MiniMax') || model.startsWith('minimax')))
        return true
    if (canonical === 'cohere' && model.startsWith('command')) return true
    if (canonical === 'amazon-q') return true

    const lower = model.toLowerCase().trim()
    const models = getProviderModels(provider)
    if (models.some((m) => m.value.toLowerCase() === lower)) return true

    const canonicalModels = getProviderModels(canonical)
    if (canonicalModels.some((m) => m.value.toLowerCase() === lower)) return true

    // Check cached live models for dynamic additions within 24h TTL
    const now = Date.now()
    for (const [key, entry] of liveModelCache.entries()) {
        if (key.startsWith(`${normalized}:`) && now - entry.timestamp < LIVE_MODEL_CACHE_TTL_MS) {
            if (entry.models.some((m) => m.value.toLowerCase() === lower)) return true
        }
    }

    return false
}

/**
 * D5: the first catalog-preferred model (default first, then catalog order) that the provider
 * offers; else the first model the provider offers. Never one of `exclude` (the model that failed).
 */
export const pickModelForProvider = (
    provider: string,
    exclude: string[] = []
): string | undefined => {
    const normalized = (provider || '').toLowerCase().trim()
    if (normalized === 'december' || normalized === 'december_proxy') {
        return exclude.some((m) => m.toLowerCase() === 'december-auto')
            ? undefined
            : 'december-auto'
    }
    const available = getProviderModels(normalized)
        .map((m) => m.value)
        .filter((id) => id !== 'default')
    return pickPreferredModel(normalized, available, exclude)
}

/** the hint under a model-not-available error */
export const modelFallbackHint = (fallback?: string): string =>
    fallback
        ? `Press [Enter] to switch to '${fallback}' & retry · [m] /model · [Esc] dismiss`
        : 'Pick an available model with `/model` or change provider with `/switch`.'

export const getDefaultModelForProvider = (provider: string): string => {
    return pickModelForProvider(provider) || 'gemini-3.8-flash'
}

export const ensureValidModelForProvider = (provider: string, model?: string): string => {
    const normalizedProvider = (provider || '').toLowerCase().trim()
    if (normalizedProvider === 'december' || normalizedProvider === 'december_proxy') {
        return 'december-auto'
    }
    if (
        (normalizedProvider === 'thinkingmachines' ||
            normalizedProvider === 'tinker' ||
            normalizedProvider === 'inkling') &&
        model
    ) {
        const lowerModel = model.toLowerCase().trim()
        if (lowerModel === 'inkling') return 'thinkingmachines/Inkling'
        if (lowerModel === 'inkling:peft:262144') return 'thinkingmachines/Inkling:peft:262144'
    }
    if (model && isValidModelForProvider(provider, model)) {
        return model
    }
    return getDefaultModelForProvider(provider)
}

/**
 * The context window for a model: what the provider's own model list says when we have read it
 * (G3), else the catalog, else a guess from the name.
 */
export const getModelContextWindow = (model: string): number => {
    const wanted = (model || '').toLowerCase().trim()
    if (wanted) {
        initDiskCacheSync()
        for (const entry of liveModelCache.values()) {
            const hit = entry.models.find((m) => m.value.toLowerCase() === wanted)
            if (hit?.contextWindow) return hit.contextWindow
        }
    }
    return getCatalogContextWindow(model)
}
