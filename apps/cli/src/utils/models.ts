import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { getModelContextWindow, MODEL_CATALOG, DYNAMIC_ENDPOINTS } from '@december/providers'

export const LIVE_MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface LiveModelCacheEntry {
    timestamp: number
    models: { label: string; value: string }[]
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
            for (const [k, v] of Object.entries(parsed as Record<string, LiveModelCacheEntry>)) {
                if (
                    v &&
                    typeof v.timestamp === 'number' &&
                    Array.isArray(v.models) &&
                    now - v.timestamp < LIVE_MODEL_CACHE_TTL_MS
                ) {
                    liveModelCache.set(k, v)
                }
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
        if (key.includes(':test-token:')) continue
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

function formatModelLabel(id: string): string {
    if (!id) return ''
    const parts = id.split(/[/:]/)
    const last = parts[parts.length - 1]
    return last
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function isChatModel(id: string): boolean {
    if (!id || typeof id !== 'string') return false
    const lower = id.toLowerCase()
    if (
        lower.includes('embedding') ||
        lower.includes('bge-') ||
        lower.includes('whisper') ||
        lower.includes('tts-') ||
        lower.includes('flux') ||
        lower.includes('sdxl') ||
        lower.includes('stable-diffusion') ||
        lower.includes('dall-e') ||
        lower.includes('rerank') ||
        lower.includes('compaction') ||
        lower.startsWith('copilot-search') ||
        lower.startsWith('exec-agent')
    ) {
        return false
    }
    return true
}

export async function fetchLiveProviderModels(
    provider: string,
    apiKey?: string,
    baseUrl?: string,
    fetchFn: typeof fetch = fetch
): Promise<{ label: string; value: string }[]> {
    const normalized = (provider || '').toLowerCase().trim()
    const curated = getCuratedProviderModels(normalized)

    if (normalized === 'december' || normalized === 'december_proxy') {
        return curated
    }

    if (normalized === 'openrouter') {
        const cacheKey = `openrouter:${apiKey || 'none'}:${baseUrl || 'default'}`
        const cached = liveModelCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < LIVE_MODEL_CACHE_TTL_MS) {
            return cached.models
        }
        const { fetchOpenRouterModels } = await import('./openrouter-models')
        const models = await fetchOpenRouterModels(apiKey, false, fetchFn)
        if (models && models.length > 0) {
            liveModelCache.set(cacheKey, {
                timestamp: Date.now(),
                models,
            })
            saveDiskCache().catch(() => {})
        }
        return models
    }

    if (!apiKey) {
        return curated
    }

    const cacheKey = `${normalized}:${apiKey}:${baseUrl || 'default'}`
    const cached = liveModelCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < LIVE_MODEL_CACHE_TTL_MS) {
        return cached.models
    }

    try {
        let endpoint = ''
        const headers: Record<string, string> = { Accept: 'application/json' }

        const isAntigravity = normalized === 'antigravity'
        let isPostRpc = false
        let requestBody: any = undefined

        if (isAntigravity) {
            endpoint = 'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
            headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`
            headers['Content-Type'] = 'application/json'
            headers['User-Agent'] = 'google-antigravity-cli/1.0'
            isPostRpc = true
            requestBody = JSON.stringify({ project: 'aicode-consumers' })
        } else if (normalized === 'google' || normalized === 'gemini') {
            if (
                apiKey.startsWith('ya29.') ||
                apiKey.startsWith('Bearer ') ||
                apiKey.includes('.')
            ) {
                endpoint = 'https://generativelanguage.googleapis.com/v1beta/models'
                headers['Authorization'] = apiKey.startsWith('Bearer ')
                    ? apiKey
                    : `Bearer ${apiKey}`
            } else {
                endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
            }
        } else if (normalized === 'anthropic' || normalized === 'claude') {
            endpoint = 'https://api.anthropic.com/v1/models'
            headers['anthropic-version'] = '2023-06-01'
            const isOAuth =
                normalized === 'claude' ||
                apiKey.startsWith('sk-ant-oat') ||
                apiKey.startsWith('Bearer ')
            if (isOAuth) {
                headers['Authorization'] = apiKey.startsWith('Bearer ')
                    ? apiKey
                    : `Bearer ${apiKey}`
                headers['anthropic-beta'] = 'claude-code-20250219,oauth-2024-06-20'
            } else {
                headers['x-api-key'] = apiKey
            }
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`
            switch (normalized) {
                case 'openai':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.openai.com/v1/models'
                    break
                case 'codex':
                case 'chatgpt':
                    if (baseUrl) {
                        endpoint = `${baseUrl.replace(/\/+$/, '')}/models`
                    } else {
                        return curated
                    }
                    break
                case 'deepseek':
                    endpoint = 'https://api.deepseek.com/models'
                    break
                case 'groq':
                    endpoint = 'https://api.groq.com/openai/v1/models'
                    break
                case 'mistral':
                case 'mistralai':
                case 'mistral-ai':
                    endpoint = 'https://api.mistral.ai/v1/models'
                    break
                case 'xai':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.x.ai/v1/models'
                    break
                case 'xiaomi':
                case 'mimo':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.xiaomimimo.com/v1/models'
                    break
                case 'zai':
                case 'zhipu':
                case 'zhipuai':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.z.ai/api/coding/paas/v4/models'
                    break
                case 'together':
                case 'togetherai':
                    endpoint = 'https://api.together.xyz/v1/models'
                    break
                case 'fireworks':
                case 'fireworksai':
                    endpoint = 'https://api.fireworks.ai/inference/v1/models'
                    break
                case 'siliconflow':
                case 'siliconcloud':
                    endpoint = 'https://api.siliconflow.cn/v1/models'
                    break
                case 'dashscope':
                case 'qwen':
                    endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/models'
                    break
                case 'minimax':
                case 'minimaxai':
                case 'minimax-ai':
                    endpoint = 'https://api.minimax.io/v1/models'
                    break
                case 'cerebras':
                    endpoint = 'https://api.cerebras.ai/v1/models'
                    break
                case 'sambanova':
                    endpoint = 'https://api.sambanova.ai/v1/models'
                    break
                case 'nvidia':
                case 'nim':
                    endpoint = 'https://integrate.api.nvidia.com/v1/models'
                    break
                case 'cohere':
                    endpoint = 'https://api.cohere.com/v2/models'
                    break
                case 'kimi':
                case 'moonshot':
                case 'moonshoot':
                case 'moonshotai':
                case 'moonshot-ai':
                    endpoint = 'https://api.moonshot.ai/v1/models'
                    break
                case 'huggingface':
                    endpoint = 'https://router.huggingface.co/v1/models'
                    break
                case 'hyperbolic':
                    endpoint = 'https://api.hyperbolic.xyz/v1/models'
                    break
                case 'arcee':
                case 'arceeai':
                case 'arcee-ai':
                    endpoint = 'https://api.arcee.ai/api/v1/models'
                    break
                case 'meta':
                case 'metaai':
                case 'meta-ai':
                    endpoint = 'https://api.meta.ai/v1/models'
                    break
                case 'sakana':
                case 'sakanaai':
                case 'sakana-ai':
                    endpoint = 'https://api.sakana.ai/v1/models'
                    break
                case 'sarvam':
                case 'sarvamai':
                case 'sarvam-ai':
                    endpoint = 'https://api.sarvam.ai/v1/models'
                    break
                case 'stepfun':
                case 'stepfunai':
                case 'stepfun-ai':
                    endpoint = 'https://api.stepfun.ai/v1/models'
                    break
                case 'upstage':
                case 'upstageai':
                case 'solar':
                    endpoint = 'https://api.upstage.ai/v1/solar/models'
                    break
                case 'december':
                case 'december_proxy': {
                    const serverUrl = process.env.SERVER_URL || 'https://api.trydecember.com'
                    endpoint = `${serverUrl.replace(/\/+$/, '')}/api/v1/cli/models`
                    break
                }
                case 'copilot':
                case 'github_copilot':
                case 'github':
                    endpoint = 'https://api.individual.githubcopilot.com/models'
                    headers['Editor-Version'] = 'vscode/1.95.0'
                    headers['Editor-Plugin-Version'] = 'copilot/1.240.0'
                    headers['User-Agent'] = 'GithubCopilot/1.240.0'
                    break
                default: {
                    const dynamic =
                        DYNAMIC_ENDPOINTS[normalized] ||
                        DYNAMIC_ENDPOINTS[MODEL_CATALOG.aliases[normalized] || '']
                    if (dynamic) {
                        endpoint = baseUrl
                            ? `${baseUrl.replace(/\/+$/, '')}/models`
                            : `${dynamic.baseURL.replace(/\/+$/, '')}/models`
                        if (dynamic.defaultHeaders) {
                            Object.assign(headers, dynamic.defaultHeaders)
                        }
                    } else if (baseUrl) {
                        const clean = baseUrl.replace(/\/+$/, '')
                        endpoint = clean.endsWith('/v1') ? `${clean}/models` : `${clean}/v1/models`
                    }
                    break
                }
            }
        }

        if (!endpoint) {
            return curated
        }

        const fetchOptions: RequestInit = {
            headers,
            signal: AbortSignal.timeout(4000),
        }
        if (isPostRpc) {
            fetchOptions.method = 'POST'
            fetchOptions.body = requestBody
        }

        const res = await fetchFn(endpoint, fetchOptions)

        if (!res.ok) {
            return curated
        }

        const json = (await res.json()) as any
        const liveItems: { label: string; value: string }[] = []

        if (isAntigravity && json.models) {
            for (const [id, m] of Object.entries(json.models as Record<string, any>)) {
                if (!id || id.startsWith('tab_') || id.startsWith('chat_2')) continue
                let label = m?.displayName || formatModelLabel(id)
                let value = id
                if (id === 'gemini-3.8-flash-tiered') {
                    value = 'gemini-3.8-flash'
                    label = 'Gemini 3.8 Flash (High)'
                }
                liveItems.push({ label, value })
            }
        } else if (normalized === 'google' || normalized === 'gemini') {
            const rawModels = json.models || []
            for (const m of rawModels) {
                const id = (m.name || '').replace(/^models\//, '')
                if (
                    id &&
                    (id.includes('gemini') || id.includes('gemma')) &&
                    !id.includes('image') &&
                    !id.includes('banana') &&
                    !id.includes('deep-research') &&
                    !id.includes('embedding') &&
                    !id.includes('aqa')
                ) {
                    liveItems.push({
                        label: m.displayName || formatModelLabel(id),
                        value: id,
                    })
                }
            }
        } else if (normalized === 'anthropic' || normalized === 'claude') {
            const rawModels = json.data || []
            for (const m of rawModels) {
                if (m.id) {
                    liveItems.push({
                        label: m.display_name || formatModelLabel(m.id),
                        value: m.id,
                    })
                }
            }
        } else if (Array.isArray(json.data)) {
            for (const m of json.data) {
                const id = m.id || m.name
                if (id && typeof id === 'string' && isChatModel(id)) {
                    liveItems.push({
                        label: formatModelLabel(id),
                        value: id,
                    })
                }
            }
        } else if (Array.isArray(json.models)) {
            for (const m of json.models) {
                const id = typeof m === 'string' ? m : m.name || m.id
                if (id && typeof id === 'string' && isChatModel(id)) {
                    liveItems.push({
                        label: formatModelLabel(id),
                        value: id,
                    })
                }
            }
        }

        if (liveItems.length === 0) {
            return curated
        }

        const seen = new Set<string>()
        const merged: { label: string; value: string }[] = []

        // Live models directly returned from the provider API take precedence
        for (const item of liveItems) {
            if (!seen.has(item.value)) {
                seen.add(item.value)
                merged.push(item)
            }
        }

        for (const m of curated) {
            if (!seen.has(m.value)) {
                seen.add(m.value)
                merged.push(m)
            }
        }

        liveModelCache.set(cacheKey, {
            timestamp: Date.now(),
            models: merged,
        })
        saveDiskCache().catch(() => {})

        return merged
    } catch {
        // Intentionally swallowed: return curated fallback models on timeout or network error
        return curated
    }
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

export const getDefaultModelForProvider = (provider: string): string => {
    const normalized = (provider || '').toLowerCase().trim()
    if (normalized === 'december' || normalized === 'december_proxy') {
        return 'december-auto'
    }
    const canonical = MODEL_CATALOG.aliases[normalized] || normalized
    const entry = MODEL_CATALOG.providers[canonical]
    if (entry && entry.defaultModel) {
        return entry.defaultModel
    }
    const models = getProviderModels(provider)
    if (models && models.length > 0) {
        return models[0].value
    }
    return 'gemini-3.8-flash'
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

export { getModelContextWindow }
