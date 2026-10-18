import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { getModelContextWindow, MODEL_CATALOG } from '@december/providers'

export const LIVE_MODEL_CACHE_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours

export interface LiveModelCacheEntry {
    timestamp: number
    models: { label: string; value: string }[]
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
            return entry.models
        }
    }
    return getCuratedProviderModels(normalized)
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
    if (lower.includes('embedding')) return false
    if (lower.startsWith('copilot-search') || lower.startsWith('exec-agent')) return false
    if (lower.includes('compaction')) return false
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

        if (normalized === 'google' || normalized === 'gemini') {
            const isOAuth =
                apiKey.startsWith('ya29.') ||
                apiKey.startsWith('Bearer ') ||
                apiKey.includes('.') ||
                normalized === 'gemini'
            if (isOAuth && !apiKey.startsWith('AIza')) {
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
                case 'codex':
                case 'chatgpt':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.openai.com/v1/models'
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
                case 'agentrouter':
                case 'agentrouter.org':
                    endpoint = 'https://agentrouter.org/v1/models'
                    headers['User-Agent'] = 'claude-cli/2.1.0 (external, sdk-cli)'
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
                case 'abliteration':
                case 'abliterationai':
                case 'abliteration-ai':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.abliteration.ai/v1/models'
                    break
                case 'agnes':
                case 'agnesai':
                case 'agnes-ai':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://apihub.agnes-ai.com/v1/models'
                    break
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.ai-router.dev/v1/models'
                    break
                case 'aiand':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.aiand.com/v1/models'
                    break
                case 'aki':
                case 'aki-io':
                case 'akiio':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://aki.io/v1/models'
                    break
                case 'ambient':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.ambient.xyz/v1/models'
                    break
                case 'auriko':
                case 'aurikoai':
                case 'auriko-ai':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://api.auriko.ai/v1/models'
                    break
                case 'baseten':
                case 'basetenco':
                case 'baseten-co':
                    endpoint = baseUrl
                        ? `${baseUrl.replace(/\/+$/, '')}/models`
                        : 'https://inference.baseten.co/v1/models'
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
                default:
                    if (baseUrl) {
                        const clean = baseUrl.replace(/\/+$/, '')
                        endpoint = clean.endsWith('/v1') ? `${clean}/models` : `${clean}/v1/models`
                    }
                    break
            }
        }

        if (!endpoint) {
            return curated
        }

        const res = await fetchFn(endpoint, {
            headers,
            signal: AbortSignal.timeout(3500),
        })

        if (!res.ok) {
            return curated
        }

        const json = (await res.json()) as any
        const liveItems: { label: string; value: string }[] = []

        if (normalized === 'google' || normalized === 'gemini') {
            const rawModels = json.models || []
            for (const m of rawModels) {
                const id = (m.name || '').replace(/^models\//, '')
                if (id && (id.includes('gemini') || id.includes('gemma'))) {
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

        for (const m of curated) {
            seen.add(m.value)
            merged.push(m)
        }

        for (const item of liveItems) {
            if (!seen.has(item.value)) {
                seen.add(item.value)
                merged.push(item)
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
        'agentrouter',
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
        'abliteration',
        'agnes',
        'aiand',
        'aki',
        'ambient',
        'auriko',
        'baseten',
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
    if (normalized === 'openrouter' && (model.includes('/') || model.includes(':'))) return true
    if (normalized === 'agentrouter' && (model.includes('/') || model.includes(':'))) return true
    if (normalized === 'arcee' && (model.includes('/') || model.includes(':'))) return true
    if (normalized === 'meta' && (model.includes('/') || model.includes(':'))) return true
    if (
        (normalized === 'xiaomi' || normalized === 'mimo') &&
        (model.includes('/') || model.startsWith('mimo'))
    )
        return true
    if (
        (normalized === 'zai' || normalized === 'zhipu' || normalized === 'zhipuai') &&
        (model.includes('/') || model.startsWith('glm'))
    )
        return true
    if (
        (normalized === 'abliteration' ||
            normalized === 'abliterationai' ||
            normalized === 'abliteration-ai') &&
        (model.includes('/') || model.startsWith('abliterated'))
    )
        return true
    if (
        (normalized === 'agnes' || normalized === 'agnesai' || normalized === 'agnes-ai') &&
        (model.includes('/') || model.startsWith('agnes'))
    )
        return true

    if (
        normalized === 'aiand' &&
        (model.includes('/') ||
            model.startsWith('deepseek') ||
            model.startsWith('glm') ||
            model.startsWith('kimi') ||
            model.startsWith('gemma') ||
            model.startsWith('gpt') ||
            model.startsWith('motif') ||
            model.startsWith('qwen'))
    )
        return true
    if (
        (normalized === 'aki' || normalized === 'aki-io' || normalized === 'akiio') &&
        (model.includes('/') ||
            model.startsWith('deepseek') ||
            model.startsWith('glm') ||
            model.startsWith('gemma') ||
            model.startsWith('gpt') ||
            model.startsWith('mistral') ||
            model.startsWith('qwen'))
    )
        return true
    if (
        normalized === 'ambient' &&
        (model.includes('/') ||
            model.startsWith('ambient') ||
            model.startsWith('glm') ||
            model.startsWith('qwen') ||
            model.startsWith('z-ai'))
    )
        return true
    if (
        (normalized === 'auriko' || normalized === 'aurikoai' || normalized === 'auriko-ai') &&
        (model.includes('/') ||
            model.startsWith('claude') ||
            model.startsWith('deepseek') ||
            model.startsWith('gemini') ||
            model.startsWith('glm') ||
            model.startsWith('grok') ||
            model.startsWith('kimi') ||
            model.startsWith('minimax') ||
            model.startsWith('qwen'))
    )
        return true
    if (
        (normalized === 'baseten' || normalized === 'basetenco' || normalized === 'baseten-co') &&
        (model.includes('/') ||
            model.startsWith('deepseek') ||
            model.startsWith('zai') ||
            model.startsWith('glm') ||
            model.startsWith('moonshot') ||
            model.startsWith('kimi') ||
            model.startsWith('thinkingmachines') ||
            model.startsWith('inkling') ||
            model.startsWith('nvidia') ||
            model.startsWith('nemotron') ||
            model.startsWith('gpt'))
    )
        return true
    if (
        normalized === 'sakana' &&
        (model.includes('/') || model.startsWith('fugu') || model.startsWith('sakana'))
    )
        return true
    if (
        (normalized === 'thinkingmachines' ||
            normalized === 'tinker' ||
            normalized === 'inkling') &&
        (model.includes('/') || model.startsWith('inkling'))
    )
        return true
    if (normalized === 'december' || normalized === 'december_proxy') {
        return model.toLowerCase() === 'december-auto'
    }

    const models = getProviderModels(normalized)
    if (models.some((m) => m.value === model)) return true

    // Check cached live models for dynamic additions within 48h TTL
    const now = Date.now()
    for (const [key, entry] of liveModelCache.entries()) {
        if (key.startsWith(`${normalized}:`) && now - entry.timestamp < LIVE_MODEL_CACHE_TTL_MS) {
            if (entry.models.some((m) => m.value === model)) return true
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
