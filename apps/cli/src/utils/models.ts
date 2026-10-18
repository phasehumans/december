import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { getModelContextWindow } from '@december/providers'

import { FALLBACK_OPENROUTER_MODELS } from './openrouter-models'

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

export const getCuratedProviderModels = (provider: string) => {
    const normalized = (provider || '').toLowerCase().trim()
    switch (normalized) {
        case 'anthropic':
            return [
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
                { label: 'Claude Fable 5.1', value: 'claude-fable-5-1' },
                { label: 'Claude Fable 5', value: 'claude-fable-5' },
                { label: 'Claude Haiku 4.5', value: 'claude-haiku-4.5' },
                { label: 'Claude Opus 4.8', value: 'claude-opus-4.8' },
                { label: 'Claude Opus 4.7', value: 'claude-opus-4.7' },
                { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4.6' },
                { label: 'Claude Opus 4.6', value: 'claude-opus-4.6' },
                { label: 'Claude Opus 4.5', value: 'claude-opus-4.5' },
                { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
            ]
        case 'google':
        case 'gemini':
            return [
                { label: 'Gemini 3.8 Flash', value: 'gemini-3.8-flash' },
                { label: 'Gemini 3.7 Flash', value: 'gemini-3.7-flash' },
                { label: 'Gemini 3.6 Flash', value: 'gemini-3.6-flash' },
                { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
                { label: 'Gemini 3.5 Flash Lite', value: 'gemini-3.5-flash-lite' },
                { label: 'Gemini 3.1 Pro Preview', value: 'gemini-3.1-pro-preview' },
                { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
                { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
                { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
                { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
                { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
            ]
        case 'openai':
            return [
                { label: 'GPT-5.6 Sol', value: 'gpt-5.6-sol' },
                { label: 'GPT-5.6 Terra', value: 'gpt-5.6-terra' },
                { label: 'GPT-5.6 Luna', value: 'gpt-5.6-luna' },
                { label: 'GPT-5.5 Pro', value: 'gpt-5.5-pro' },
                { label: 'GPT-5.5', value: 'gpt-5.5' },
                { label: 'GPT-5.4 Pro', value: 'gpt-5.4-pro' },
                { label: 'GPT-5.4', value: 'gpt-5.4' },
                { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
                { label: 'o4-mini', value: 'o4-mini' },
                { label: 'o3-pro', value: 'o3-pro' },
                { label: 'o3', value: 'o3' },
                { label: 'o3-mini', value: 'o3-mini' },
                { label: 'o1-pro', value: 'o1-pro' },
                { label: 'GPT-4.1', value: 'gpt-4.1' },
                { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
                { label: 'GPT-4o', value: 'gpt-4o' },
                { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
            ]
        case 'openrouter':
            return FALLBACK_OPENROUTER_MODELS
        case 'deepseek':
            return [
                { label: 'DeepSeek V4 Pro', value: 'deepseek-v4-pro' },
                { label: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash' },
                { label: 'DeepSeek Chat', value: 'deepseek-chat' },
                { label: 'DeepSeek Reasoner', value: 'deepseek-reasoner' },
            ]
        case 'groq':
            return [
                { label: 'GPT-OSS 120B', value: 'openai/gpt-oss-120b' },
                { label: 'GPT-OSS 20B', value: 'openai/gpt-oss-20b' },
                { label: 'Llama 3.3 70B Versatile', value: 'llama-3.3-70b-versatile' },
                { label: 'Llama 3.1 8B Instant', value: 'llama-3.1-8b-instant' },
                { label: 'Qwen 3.6 27B', value: 'qwen/qwen3.6-27b' },
                { label: 'Qwen 3.8 27B', value: 'qwen/qwen3.8-27b' },
                { label: 'Groq Compound System', value: 'groq/compound' },
                { label: 'Groq Compound Mini', value: 'groq/compound-mini' },
            ]
        case 'huggingface':
            return [
                {
                    label: 'Llama 3.3 70B Instruct',
                    value: 'meta-llama/Llama-3.3-70B-Instruct',
                },
                { label: 'Llama 3.1 8B Instruct', value: 'meta-llama/Meta-Llama-3.1-8B-Instruct' },
                { label: 'DeepSeek V4 Flash', value: 'deepseek-ai/DeepSeek-V4-Flash' },
                { label: 'GPT-OSS 120B', value: 'openai/gpt-oss-120b' },
                { label: 'Qwen 3 Coder 30B', value: 'Qwen/Qwen3-Coder-30B-A3B-Instruct' },
                { label: 'Qwen 2.5 Coder 32B', value: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
                { label: 'Qwen 2.5 72B', value: 'Qwen/Qwen2.5-72B-Instruct' },
                { label: 'Kimi K3', value: 'moonshotai/Kimi-K3' },
            ]
        case 'kimi':
        case 'moonshot':
        case 'moonshoot':
        case 'moonshotai':
        case 'moonshot-ai':
            return [
                { label: 'Kimi K3', value: 'kimi-k3' },
                { label: 'Kimi K2.7 Code', value: 'kimi-k2.7-code' },
                { label: 'Kimi K2.7 Code Highspeed', value: 'kimi-k2.7-code-highspeed' },
                { label: 'Kimi K2.6', value: 'kimi-k2.6' },
                { label: 'Kimi K2.5', value: 'kimi-k2.5' },
            ]
        case 'mistral':
        case 'mistralai':
        case 'mistral-ai':
            return [
                { label: 'Mistral Large', value: 'mistral-large-latest' },
                { label: 'Codestral', value: 'codestral-latest' },
                { label: 'Devstral 2', value: 'devstral-2512' },
                { label: 'Devstral', value: 'devstral-latest' },
                { label: 'Devstral Medium', value: 'devstral-medium-latest' },
                { label: 'Mistral Medium', value: 'mistral-medium-latest' },
                { label: 'Mistral Small', value: 'mistral-small-latest' },
                { label: 'Magistral Medium', value: 'magistral-medium-latest' },
                { label: 'Magistral Small', value: 'magistral-small' },
                { label: 'Ministral 8B', value: 'ministral-8b-latest' },
                { label: 'Ministral 3B', value: 'ministral-3b-latest' },
                { label: 'Open Mistral Nemo', value: 'open-mistral-nemo' },
                { label: 'Mistral Nemo', value: 'mistral-nemo' },
                { label: 'Pixtral Large', value: 'pixtral-large-latest' },
                { label: 'Pixtral 12B', value: 'pixtral-12b' },
                { label: 'Open Mixtral 8x22B', value: 'open-mixtral-8x22b' },
            ]
        case 'xai':
            return [
                { label: 'Grok 4.6', value: 'grok-4.6' },
                { label: 'Grok 4.5', value: 'grok-4.5' },
                { label: 'Grok 4.3', value: 'grok-4.3' },
                { label: 'Grok 4.20', value: 'grok-4.20' },
                { label: 'Grok 4.1 Fast', value: 'grok-4.1-fast' },
                { label: 'Grok Build 0.1', value: 'grok-build-0.1' },
            ]
        case 'xiaomi':
        case 'mimo':
            return [
                { label: 'MiMo v2.5', value: 'mimo-v2.5' },
                { label: 'MiMo v2.5 Pro', value: 'mimo-v2.5-pro' },
                { label: 'MiMo v2.5 Pro Ultraspeed', value: 'mimo-v2.5-pro-ultraspeed' },
                { label: 'MiMo v2 Flash', value: 'mimo-v2-flash' },
                { label: 'MiMo v2 Omni', value: 'mimo-v2-omni' },
                { label: 'MiMo v2 Pro', value: 'mimo-v2-pro' },
            ]
        case 'zai':
        case 'zhipu':
        case 'zhipuai':
            return [
                { label: 'GLM 5.3 Flash', value: 'glm-5.3-flash' },
                { label: 'GLM 5.3', value: 'glm-5.3' },
                { label: 'GLM 5.2', value: 'glm-5.2' },
                { label: 'GLM 5.1', value: 'glm-5.1' },
                { label: 'GLM 5', value: 'glm-5' },
                { label: 'GLM 5 Turbo', value: 'glm-5-turbo' },
                { label: 'GLM 4.7', value: 'glm-4.7' },
                { label: 'GLM 4.7 Flash', value: 'glm-4.7-flash' },
                { label: 'GLM 4.7 FlashX', value: 'glm-4.7-flashx' },
                { label: 'GLM 4.6', value: 'glm-4.6' },
                { label: 'GLM 4.5', value: 'glm-4.5' },
                { label: 'GLM 4.5 Air', value: 'glm-4.5-air' },
                { label: 'GLM 4 Plus', value: 'glm-4-plus' },
                { label: 'GLM 4 Flash', value: 'glm-4-flash' },
            ]
        case 'nvidia':
        case 'nim':
            return [
                { label: 'GPT-OSS 120B', value: 'openai/gpt-oss-120b' },
                { label: 'GPT-OSS 20B', value: 'openai/gpt-oss-20b' },
                { label: 'Nemotron 3.5 Lightning', value: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
                { label: 'Nemotron 3 Super 120B', value: 'nvidia/nemotron-3-super-120b-a12b' },
                { label: 'Nemotron 3 Ultra 550B', value: 'nvidia/nemotron-3-ultra-550b-a55b' },
                { label: 'Llama 3.2 11B Vision', value: 'meta/llama-3.2-11b-vision-instruct' },
                { label: 'Kimi K3', value: 'moonshotai/kimi-k3' },
                { label: 'MiniMax M3', value: 'minimaxai/minimax-m3' },
            ]
        case 'sambanova':
            return [
                {
                    label: 'Llama 3.3 70B Instruct',
                    value: 'Meta-Llama-3.3-70B-Instruct',
                },
                {
                    label: 'Llama 3.1 405B Instruct',
                    value: 'Meta-Llama-3.1-405B-Instruct',
                },
                { label: 'DeepSeek R1', value: 'DeepSeek-R1' },
                { label: 'DeepSeek V3', value: 'DeepSeek-V3' },
                { label: 'Llama 3.1 8B Instruct', value: 'Meta-Llama-3.1-8B-Instruct' },
                { label: 'Qwen 2.5 Coder 32B', value: 'Qwen2.5-Coder-32B-Instruct' },
            ]
        case 'cerebras':
            return [
                { label: 'GPT-OSS 120B', value: 'gpt-oss-120b' },
                { label: 'Gemma 4 31B', value: 'gemma-4-31b' },
                { label: 'Llama 3.3 70B', value: 'llama-3.3-70b' },
                { label: 'Llama 3.1 8B', value: 'llama3.1-8b' },
            ]
        case 'siliconflow':
        case 'siliconcloud':
            return [
                { label: 'DeepSeek V4 Pro', value: 'deepseek-ai/DeepSeek-V4-Pro' },
                { label: 'DeepSeek V4 Flash', value: 'deepseek-ai/DeepSeek-V4-Flash' },
                { label: 'DeepSeek R1', value: 'deepseek-ai/DeepSeek-R1' },
                { label: 'DeepSeek V3', value: 'deepseek-ai/DeepSeek-V3' },
                { label: 'GPT-OSS 120B', value: 'openai/gpt-oss-120b' },
                { label: 'Qwen 3 Coder 30B', value: 'Qwen/Qwen3-Coder-30B-A3B-Instruct' },
                { label: 'Qwen 2.5 Coder 32B', value: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
                { label: 'Qwen 2.5 72B', value: 'Qwen/Qwen2.5-72B-Instruct' },
                { label: 'GLM 5', value: 'zai-org/GLM-5' },
                { label: 'MiniMax M3', value: 'MiniMaxAI/MiniMax-M3' },
            ]
        case 'together':
        case 'togetherai':
            return [
                {
                    label: 'Llama 3.3 70B Turbo',
                    value: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
                },
                { label: 'DeepSeek V4 Pro', value: 'deepseek-ai/DeepSeek-V4-Pro' },
                { label: 'DeepSeek R1', value: 'deepseek-ai/DeepSeek-R1' },
                { label: 'DeepSeek V3', value: 'deepseek-ai/DeepSeek-V3' },
                { label: 'GPT-OSS 120B', value: 'openai/gpt-oss-120b' },
                { label: 'Kimi K3', value: 'moonshotai/Kimi-K3' },
                { label: 'GLM 5.3 Flash', value: 'zai-org/GLM-5.3-Flash' },
                { label: 'Qwen 3 Coder 480B', value: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8' },
            ]
        case 'hyperbolic':
            return [
                { label: 'DeepSeek R1', value: 'deepseek-ai/DeepSeek-R1' },
                { label: 'DeepSeek V3', value: 'deepseek-ai/DeepSeek-V3' },
                { label: 'Llama 3.3 70B', value: 'meta-llama/Llama-3.3-70B-Instruct' },
                { label: 'Llama 3.1 405B', value: 'meta-llama/Meta-Llama-3.1-405B-Instruct' },
                { label: 'Llama 3.1 70B', value: 'meta-llama/Meta-Llama-3.1-70B-Instruct' },
                { label: 'Qwen 2.5 Coder 32B', value: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
                { label: 'Qwen 2.5 72B', value: 'Qwen/Qwen2.5-72B-Instruct' },
            ]
        case 'fireworks':
        case 'fireworksai':
            return [
                {
                    label: 'DeepSeek V4 Pro',
                    value: 'accounts/fireworks/models/deepseek-v4-pro-0813',
                },
                {
                    label: 'DeepSeek V4 Flash',
                    value: 'accounts/fireworks/models/deepseek-v4-flash-0731',
                },
                {
                    label: 'DeepSeek R1',
                    value: 'accounts/fireworks/models/deepseek-r1',
                },
                { label: 'DeepSeek V3', value: 'accounts/fireworks/models/deepseek-v3' },
                { label: 'Kimi K3', value: 'accounts/fireworks/models/kimi-k3' },
                { label: 'GLM 5.3 Flash', value: 'accounts/fireworks/models/glm-5p3-flash' },
                { label: 'GPT-OSS 120B', value: 'accounts/fireworks/models/gpt-oss-120b' },
                { label: 'MiniMax M3', value: 'accounts/fireworks/models/minimax-m3' },
                {
                    label: 'Llama 3.3 70B',
                    value: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
                },
                {
                    label: 'Llama 3.1 405B',
                    value: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
                },
                {
                    label: 'Qwen 2.5 Coder 32B',
                    value: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct',
                },
                { label: 'Qwen 2.5 72B', value: 'accounts/fireworks/models/qwen2p5-72b-instruct' },
            ]
        case 'perplexity':
            return [
                { label: 'Sonar Deep Research', value: 'sonar-deep-research' },
                { label: 'Sonar Reasoning Pro', value: 'sonar-reasoning-pro' },
                { label: 'Sonar Pro', value: 'sonar-pro' },
                { label: 'Sonar', value: 'sonar' },
            ]
        case 'cohere':
            return [
                { label: 'Command A Plus', value: 'command-a-plus-05-2026' },
                { label: 'Command A Reasoning', value: 'command-a-reasoning-08-2025' },
                { label: 'Command A', value: 'command-a-03-2025' },
                { label: 'Command R+', value: 'command-r-plus-08-2024' },
                { label: 'Command R', value: 'command-r-08-2024' },
            ]
        case 'agentrouter':
        case 'agentrouter.org':
            return [
                { label: 'GLM 5.3', value: 'glm-5.3' },
                { label: 'GPT-5.6 Sol', value: 'gpt-5.6-sol' },
                { label: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash' },
                { label: 'Claude Opus 4.8', value: 'claude-opus-4-8' },
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
            ]
        case 'december':
        case 'december_proxy':
            return [{ label: 'Humans R1', value: 'december-auto' }]
        case 'copilot':
        case 'github_copilot':
        case 'github':
            return [
                { label: 'GPT-4o', value: 'gpt-4o' },
                { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
                { label: 'GPT-4.1', value: 'gpt-4.1' },
            ]
        case 'claude':
            return getCuratedProviderModels('anthropic')
        case 'codex':
        case 'chatgpt':
            return [
                { label: 'GPT-5.6 Sol', value: 'gpt-5.6-sol' },
                { label: 'GPT-5.6 Terra', value: 'gpt-5.6-terra' },
                { label: 'GPT-5.6 Luna', value: 'gpt-5.6-luna' },
                { label: 'GPT-5.5', value: 'gpt-5.5' },
            ]
        case 'antigravity':
            return getCuratedProviderModels('gemini')
        case 'minimax':
        case 'minimaxai':
        case 'minimax-ai':
            return [
                { label: 'MiniMax M3', value: 'MiniMax-M3' },
                { label: 'MiniMax M2.7', value: 'MiniMax-M2.7' },
                { label: 'MiniMax M2.7 Highspeed', value: 'MiniMax-M2.7-highspeed' },
                { label: 'MiniMax M2.5', value: 'MiniMax-M2.5' },
                { label: 'MiniMax M2.5 Highspeed', value: 'MiniMax-M2.5-highspeed' },
                { label: 'MiniMax M2.1', value: 'MiniMax-M2.1' },
                { label: 'MiniMax M2.1 Highspeed', value: 'MiniMax-M2.1-highspeed' },
                { label: 'MiniMax M2', value: 'MiniMax-M2' },
                { label: 'MiniMax Text 01', value: 'MiniMax-Text-01' },
                { label: 'MiniMax VL 01', value: 'MiniMax-VL-01' },
            ]
        case 'arcee':
        case 'arceeai':
        case 'arcee-ai':
            return [
                { label: 'Trinity Large Thinking', value: 'trinity-large-thinking' },
                {
                    label: 'DeepSeek V4 Flash',
                    value: 'deepseek/deepseek-v4-flash-latest',
                },
                { label: 'DeepSeek V4 Pro', value: 'deepseek/deepseek-v4-pro' },
                {
                    label: 'DeepSeek V4 Pro 0813',
                    value: 'deepseek/deepseek-v4-pro-0813',
                },
                { label: 'GLM 5.2', value: 'zai-org/glm-5.2' },
                { label: 'Kimi K3', value: 'moonshotai/kimi-k3' },
                { label: 'Inkling Small', value: 'thinkingmachines/inkling-small' },
            ]
        case 'meta':
        case 'metaai':
        case 'meta-ai':
            return [
                { label: 'Muse Spark 1.3', value: 'muse-spark-1.3' },
                { label: 'Muse Spark 1.3 Contributor', value: 'muse-spark-1.3-contributor' },
                { label: 'Muse Spark 1.2', value: 'muse-spark-1.2' },
                { label: 'Muse Spark 1.2 Contributor', value: 'muse-spark-1.2-contributor' },
                { label: 'Muse Spark 1.1', value: 'muse-spark-1.1' },
            ]
        case 'sakana':
        case 'sakanaai':
        case 'sakana-ai':
            return [
                { label: 'Fugu', value: 'fugu' },
                { label: 'Fugu Ultra', value: 'fugu-ultra' },
                { label: 'Sakana Namazu', value: 'sakana-namazu' },
                { label: 'Fugu Cyber', value: 'fugu-cyber' },
            ]
        case 'sarvam':
        case 'sarvamai':
        case 'sarvam-ai':
            return [
                { label: 'Sarvam 105B', value: 'sarvam-105b' },
                { label: 'Sarvam 30B', value: 'sarvam-30b' },
            ]
        case 'stepfun':
        case 'stepfunai':
        case 'stepfun-ai':
            return [
                { label: 'Step 3.7 Flash', value: 'step-3.7-flash' },
                { label: 'Step 3.5 Flash', value: 'step-3.5-flash' },
                { label: 'Step 1 32K', value: 'step-1-32k' },
            ]
        case 'upstage':
        case 'upstageai':
        case 'solar':
            return [
                { label: 'Solar Pro 4', value: 'solar-pro4' },
                { label: 'Solar Pro 3', value: 'solar-pro3' },
                { label: 'Solar Pro 2', value: 'solar-pro2' },
                { label: 'Solar Mini', value: 'solar-mini' },
            ]
        case 'thinkingmachines':
        case 'tinker':
        case 'inkling':
            return [
                { label: 'Thinking Machines Inkling', value: 'thinkingmachines/Inkling' },
                {
                    label: 'Thinking Machines Inkling 256k',
                    value: 'thinkingmachines/Inkling:peft:262144',
                },
            ]
        case 'abliteration':
        case 'abliterationai':
        case 'abliteration-ai':
            return [
                {
                    label: 'Abliterated Model Large V2 (GLM-5.3)',
                    value: 'abliterated-model-large-v2',
                },
                {
                    label: 'Abliterated Model Large (GLM-5.2)',
                    value: 'abliterated-model-large',
                },
                { label: 'Abliterated Model (Multimodal)', value: 'abliterated-model' },
            ]
        case 'agnes':
        case 'agnesai':
        case 'agnes-ai':
            return [
                {
                    label: 'Agnes 3.0 Flash (Fast Agentic)',
                    value: 'agnes-3.0-flash',
                },
                {
                    label: 'Agnes 2.5 Pro (Flagship Reasoning)',
                    value: 'agnes-2.5-pro',
                },
                { label: 'Agnes 2.5 Flash', value: 'agnes-2.5-flash' },
                { label: 'Agnes 2.5 Pro Beta', value: 'agnes-2.5-pro-beta' },
            ]
        case 'aiand':
            return [
                {
                    label: 'DeepSeek V4 Flash (Fast & Efficient)',
                    value: 'deepseek-ai/deepseek-v4-flash',
                },
                {
                    label: 'DeepSeek V4 Pro',
                    value: 'deepseek-ai/deepseek-v4-pro',
                },
                {
                    label: 'GLM 5.3 (Zhipu AI)',
                    value: 'zai-org/glm-5.3',
                },
                {
                    label: 'GLM 5.2 (Zhipu AI)',
                    value: 'zai-org/glm-5.2',
                },
                {
                    label: 'Kimi K2.7 Code (Moonshot)',
                    value: 'moonshotai/kimi-k2.7-code',
                },
                {
                    label: 'Kimi K3 (Moonshot)',
                    value: 'moonshotai/kimi-k3',
                },
                {
                    label: 'Gemma 4 31B IT (Google)',
                    value: 'google/gemma-4-31b-it',
                },
                {
                    label: 'GPT OSS 120B (OpenAI)',
                    value: 'openai/gpt-oss-120b',
                },
                {
                    label: 'Motif 3',
                    value: 'motif-technologies/motif-3',
                },
                {
                    label: 'Qwen 3.8 27B',
                    value: 'qwen/qwen3.8-27b',
                },
            ]
        case 'aki':
        case 'aki-io':
        case 'akiio':
            return [
                {
                    label: 'DeepSeek V4 Flash 0731 284B',
                    value: 'deepseek-v4-flash-0731-284b',
                },
                {
                    label: 'GLM 5.3 754B',
                    value: 'glm5.3-754b',
                },
                {
                    label: 'Gemma 4 26B',
                    value: 'gemma4-26b',
                },
                {
                    label: 'GPT OSS 120B',
                    value: 'gpt-oss-120b',
                },
                {
                    label: 'Mistral 4 119B',
                    value: 'mistral4-119b',
                },
                {
                    label: 'Qwen 3.8 27B',
                    value: 'qwen3.8-27b',
                },
                {
                    label: 'Qwen 3.6 35B',
                    value: 'qwen3.6-35b',
                },
            ]
        case 'ambient':
            return [
                {
                    label: 'Ambient Large',
                    value: 'ambient/large',
                },
                {
                    label: 'GLM 5.2',
                    value: 'z-ai/glm-5.2',
                },
                {
                    label: 'Qwen 3.6 27B',
                    value: 'qwen/qwen3.6-27b',
                },
                {
                    label: 'Qwen 3.8 27B',
                    value: 'qwen/qwen3.8-27b',
                },
            ]
        case 'auriko':
        case 'aurikoai':
        case 'auriko-ai':
            return [
                {
                    label: 'DeepSeek V4 Flash',
                    value: 'deepseek-v4-flash',
                },
                {
                    label: 'Gemini 2.5 Flash',
                    value: 'gemini-2.5-flash',
                },
                {
                    label: 'Claude Sonnet 4.6',
                    value: 'claude-sonnet-4-6',
                },
                {
                    label: 'Claude Opus 4.6',
                    value: 'claude-opus-4-6',
                },
                {
                    label: 'Claude Opus 4.7',
                    value: 'claude-opus-4-7',
                },
                {
                    label: 'DeepSeek V4 Pro',
                    value: 'deepseek-v4-pro',
                },
                {
                    label: 'Gemini 2.5 Pro',
                    value: 'gemini-2.5-pro',
                },
                {
                    label: 'Gemini 3.1 Pro Preview',
                    value: 'gemini-3.1-pro-preview',
                },
                {
                    label: 'GLM 5.1',
                    value: 'glm-5.1',
                },
                {
                    label: 'Grok 4.3',
                    value: 'grok-4.3',
                },
                {
                    label: 'Kimi K2.5',
                    value: 'kimi-k2.5',
                },
                {
                    label: 'Kimi K2.6',
                    value: 'kimi-k2.6',
                },
                {
                    label: 'MiniMax M2.7',
                    value: 'minimax-m2-7',
                },
                {
                    label: 'MiniMax M2.7 Highspeed',
                    value: 'minimax-m2-7-highspeed',
                },
                {
                    label: 'Qwen 3.6 Plus',
                    value: 'qwen-3.6-plus',
                },
            ]
        case 'baseten':
        case 'basetenco':
        case 'baseten-co':
            return [
                {
                    label: 'DeepSeek V4.1 Flash',
                    value: 'deepseek-ai/DeepSeek-V4.1-Flash',
                },
                {
                    label: 'DeepSeek V4 Flash 0731',
                    value: 'deepseek-ai/DeepSeek-V4-Flash-0731',
                },
                {
                    label: 'DeepSeek V4 Pro',
                    value: 'deepseek-ai/DeepSeek-V4-Pro',
                },
                {
                    label: 'DeepSeek V4 Pro 0813',
                    value: 'deepseek-ai/DeepSeek-V4-Pro-0813',
                },
                {
                    label: 'DeepSeek V3.1',
                    value: 'deepseek-ai/DeepSeek-V3.1',
                },
                {
                    label: 'GLM 5.3',
                    value: 'zai-org/GLM-5.3',
                },
                {
                    label: 'GLM 5.3 Fast',
                    value: 'zai-org/GLM-5.3-Fast',
                },
                {
                    label: 'GLM 5.3 Flash',
                    value: 'zai-org/GLM-5.3-Flash',
                },
                {
                    label: 'GLM 5.2',
                    value: 'zai-org/GLM-5.2',
                },
                {
                    label: 'GLM 5.2 Fast',
                    value: 'zai-org/GLM-5.2-Fast',
                },
                {
                    label: 'GLM 5.1',
                    value: 'zai-org/GLM-5.1',
                },
                {
                    label: 'GLM 5',
                    value: 'zai-org/GLM-5',
                },
                {
                    label: 'GLM 4.7',
                    value: 'zai-org/GLM-4.7',
                },
                {
                    label: 'Kimi K2.7 Code',
                    value: 'moonshotai/Kimi-K2.7-Code',
                },
                {
                    label: 'Kimi K3',
                    value: 'moonshotai/Kimi-K3',
                },
                {
                    label: 'Kimi K2.6',
                    value: 'moonshotai/Kimi-K2.6',
                },
                {
                    label: 'Kimi K2.5',
                    value: 'moonshotai/Kimi-K2.5',
                },
                {
                    label: 'Thinking Machines Inkling',
                    value: 'thinkingmachines/inkling',
                },
                {
                    label: 'Thinking Machines Inkling Small',
                    value: 'thinkingmachines/inkling-small',
                },
                {
                    label: 'Nemotron 3 Super 120B',
                    value: 'nvidia/Nemotron-120B-A12B',
                },
                {
                    label: 'Nemotron 3 Ultra 550B',
                    value: 'nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B',
                },
                {
                    label: 'GPT OSS 120B',
                    value: 'openai/gpt-oss-120b',
                },
            ]
        case '302ai':
            return [
                { label: 'claude-sonnet-4-6', value: 'claude-sonnet-4-6' },
                { label: 'claude-sonnet-4-6-thinking', value: 'claude-sonnet-4-6-thinking' },
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Fable 5.1', value: 'claude-fable-5-1' },
                { label: 'claude-opus-4-7-thinking', value: 'claude-opus-4-7-thinking' },
                { label: 'claude-opus-4-7', value: 'claude-opus-4-7' },
                { label: 'Claude Fable 5', value: 'claude-fable-5' },
                { label: 'Claude Opus 4.8', value: 'claude-opus-4-8' },
            ]
        case 'abacus':
            return [
                {
                    label: 'Llama 4 Maverick 17B Instruct',
                    value: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
                },
                { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
                { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
                { label: 'Claude Fable 5', value: 'claude-fable-5' },
                { label: 'Claude Opus 4.8', value: 'claude-opus-4-8' },
                { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
            ]
        case 'above':
            return [
                { label: 'MiMo V2.5 Pro', value: 'mimo-v2.5-pro' },
                { label: 'DeepSeek V4 Flash Vision (Exp)', value: 'deepseek-v4-flash-vision-exp' },
                { label: 'GLM 5.2', value: 'glm-5.2' },
                { label: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash' },
                { label: 'GLM 5.2 Fast', value: 'glm-5.2-fast' },
                { label: 'GLM 5.3 Flash', value: 'glm-5.3-flash' },
                { label: 'Qwen 3.8 Max', value: 'qwen3.8-max' },
                { label: 'DeepSeek V4 Pro', value: 'deepseek-v4-pro' },
            ]
        case 'ai21':
            return [
                { label: 'Jamba Large', value: 'jamba-large' },
                { label: 'Jamba Mini', value: 'jamba-mini' },
            ]
        case 'amd':
            return [
                { label: 'DeepSeek V4 Flash 0731', value: 'DeepSeek-V4-Flash' },
                { label: 'DeepSeek V4.1 Flash', value: 'DeepSeek-V4.1-Flash' },
                { label: 'DeepSeek V4 Flash Vision Exp', value: 'DeepSeek-V4-Flash-Vision-Exp' },
                { label: 'Qwen3.8 Flash Next', value: 'Qwen3.8-Flash-Next' },
                { label: 'Qwen3.8 27B', value: 'Qwen3.8-27B' },
                { label: 'MiniCPM5-2B', value: 'MiniCPM5-2B' },
            ]
        case 'anyapi':
            return [
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
                { label: 'Claude Opus 4.6', value: 'anthropic/claude-opus-4-6' },
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4-7' },
                { label: 'DeepSeek Reasoner', value: 'deepseek/deepseek-r1' },
                { label: 'DeepSeek Chat', value: 'deepseek/deepseek-chat' },
                { label: 'Claude Haiku 4.5 (latest)', value: 'anthropic/claude-haiku-4-5' },
                { label: 'Claude Sonnet 4.5 (latest)', value: 'anthropic/claude-sonnet-4-5' },
                { label: 'GPT-5.4', value: 'openai/gpt-5.4' },
            ]
        case 'berget':
            return [
                {
                    label: 'Mistral Small 3.2 24B Instruct 2506',
                    value: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
                },
                { label: 'GLM-5.2', value: 'zai-org/GLM-5.2' },
                { label: 'GLM-5.3-Flash', value: 'zai-org/GLM-5.3-Flash' },
                { label: 'Kimi K3', value: 'moonshotai/Kimi-K3' },
                { label: 'Qwen3.8 27B', value: 'Qwen/Qwen3.8-27B-FP8' },
                { label: 'Gemma 4 31B Instruct', value: 'google/gemma-4-31B-it' },
            ]
        case 'blueclaw':
            return [
                { label: 'Qwen3.6 27B', value: 'Qwen3.6-27B' },
                { label: 'Qwen3.6 35B A3B FP8', value: 'Qwen/Qwen3.6-35B-A3B-FP8' },
            ]
        case 'chutes':
            return [
                {
                    label: 'DeepSeek V4 Flash 0731 TEE',
                    value: 'deepseek-ai/DeepSeek-V4-Flash-0731-TEE',
                },
                { label: 'GLM 5.2 TEE', value: 'zai-org/GLM-5.2-TEE' },
                { label: 'Kimi K3 TEE', value: 'moonshotai/Kimi-K3-TEE' },
                { label: 'Qwen3.8 27B TEE', value: 'Qwen/Qwen3.8-27B-TEE' },
                { label: 'Qwen3.6 27B TEE', value: 'Qwen/Qwen3.6-27B-TEE' },
                { label: 'Qwen3.5 397B A17B TEE', value: 'Qwen/Qwen3.5-397B-A17B-TEE' },
                {
                    label: 'Qwen3 235B A22B Thinking 2507 TEE',
                    value: 'Qwen/Qwen3-235B-A22B-Thinking-2507-TEE',
                },
                { label: 'Kimi K2.6 TEE', value: 'moonshotai/Kimi-K2.6-TEE' },
            ]
        case 'clarifai':
            return [
                {
                    label: 'Qwen3 Coder 30B A3B Instruct',
                    value: 'qwen/qwenCoder/models/Qwen3-Coder-30B-A3B-Instruct',
                },
                {
                    label: 'Qwen3 30B A3B Instruct 2507',
                    value: 'qwen/qwenLM/models/Qwen3-30B-A3B-Instruct-2507',
                },
                { label: 'Kimi K2.6', value: 'moonshotai/chat-completion/models/Kimi-K2_6' },
                {
                    label: 'MiniMax-M2.5 High Throughput',
                    value: 'minimaxai/chat-completion/models/MiniMax-M2_5-high-throughput',
                },
                {
                    label: 'GPT OSS 120B High Throughput',
                    value: 'openai/chat-completion/models/gpt-oss-120b-high-throughput',
                },
                { label: 'GPT OSS 20B', value: 'openai/chat-completion/models/gpt-oss-20b' },
                {
                    label: 'Qwen3 30B A3B Thinking 2507',
                    value: 'qwen/qwenLM/models/Qwen3-30B-A3B-Thinking-2507',
                },
                {
                    label: 'Ministral 3 14B Reasoning 2512',
                    value: 'mistralai/completion/models/Ministral-3-14B-Reasoning-2512',
                },
            ]
        case 'cloudferro-sherlock':
            return [
                { label: 'Llama 3.3 70B Instruct', value: 'meta-llama/Llama-3.3-70B-Instruct' },
                { label: 'Bielik 11B v2.6 Instruct', value: 'speakleash/Bielik-11B-v2.6-Instruct' },
                { label: 'Bielik 11B v3.0 Instruct', value: 'speakleash/Bielik-11B-v3.0-Instruct' },
                { label: 'MiniMax-M2.5', value: 'MiniMaxAI/MiniMax-M2.5' },
                { label: 'OpenAI GPT OSS 120B', value: 'openai/gpt-oss-120b' },
            ]
        case 'cloudflare-ai-gateway':
            return [
                { label: 'Claude Opus 4.8', value: 'anthropic/claude-opus-4.8' },
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4.7' },
                { label: 'Claude Opus 5', value: 'anthropic/claude-opus-5' },
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4.6' },
                { label: 'Claude Opus 4.6', value: 'anthropic/claude-opus-4.6' },
                { label: 'Claude Fable 5', value: 'anthropic/claude-fable-5' },
                { label: 'Claude Sonnet 4.5 (latest)', value: 'anthropic/claude-sonnet-4.5' },
                { label: 'Claude Sonnet 5', value: 'anthropic/claude-sonnet-5' },
            ]
        case 'coralbricks':
            return [
                { label: 'GLM 5.3 Flash FP4', value: 'glm-5.3-flash-fp4' },
                { label: 'GLM 5.3 FP4', value: 'glm-5.3-fp4' },
                { label: 'DeepSeek V4.1 Flash FP4', value: 'deepseek-v4.1-flash-fast-fp4' },
                { label: 'GPT OSS 120B', value: 'gpt-oss-120b' },
            ]
        case 'cortecs':
            return [
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Opus 4.6', value: 'claude-opus4-6' },
                { label: 'Claude Opus 4.7', value: 'claude-opus4-7' },
                { label: 'Claude Opus 4.8', value: 'claude-opus4-8' },
                { label: 'Claude Sonnet 4.6', value: 'claude-4-6-sonnet' },
                { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
                { label: 'Qwen3-Coder 30B-A3B Instruct', value: 'qwen3-coder-30b-a3b-instruct' },
                { label: 'qwen3-30b-a3b-instruct-2507', value: 'qwen3-30b-a3b-instruct-2507' },
            ]
        case 'crusoe':
            return [
                {
                    label: 'Qwen3 235B-A22B Instruct 2507',
                    value: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
                },
                { label: 'Llama-3.3-70B-Instruct', value: 'meta-llama/Llama-3.3-70B-Instruct' },
                { label: 'GLM-5.2', value: 'zai/GLM-5.2' },
                {
                    label: 'Nemotron 3 Nano 30B A3B',
                    value: 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
                },
                {
                    label: 'Nemotron 3 Super 120B A12B',
                    value: 'nvidia/NVIDIA-Nemotron-3-Super-120B-A12B',
                },
                { label: 'Gemma 4 31B IT', value: 'google/gemma-4-31b-it' },
                { label: 'Kimi K2.6', value: 'moonshotai/Kimi-K2.6' },
                {
                    label: 'Nemotron 3 Nano Omni 30B A3B Reasoning',
                    value: 'nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B',
                },
            ]
        case 'deepinfra':
            return [
                { label: 'Llama 4 Scout 17B', value: 'meta-llama/Llama-4-Scout-17B-16E-Instruct' },
                {
                    label: 'Qwen3 Coder 480B A35B Instruct Turbo',
                    value: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo',
                },
                {
                    label: 'Qwen3 235B-A22B Instruct 2507',
                    value: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
                },
                { label: 'Qwen3 VL 235B A22B Instruct', value: 'Qwen/Qwen3-VL-235B-A22B-Instruct' },
                { label: 'Qwen3-Next 80B-A3B Instruct', value: 'Qwen/Qwen3-Next-80B-A3B-Instruct' },
                { label: 'DeepSeek-R1-0528', value: 'deepseek-ai/DeepSeek-R1-0528' },
                {
                    label: 'Llama 3.3 Nemotron Super 49B v1.5',
                    value: 'nvidia/Llama-3.3-Nemotron-Super-49B-v1.5',
                },
                { label: 'Llama 3.3 70B Turbo', value: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
            ]
        case 'digitalocean':
            return [
                { label: 'Anthropic Claude Fable 5', value: 'anthropic-claude-fable-5' },
                { label: 'Anthropic Claude Opus 5.5', value: 'anthropic-claude-opus-5.5' },
                { label: 'Anthropic Claude Sonnet 5', value: 'anthropic-claude-5-sonnet' },
                { label: 'Claude Sonnet 4', value: 'anthropic-claude-sonnet-4' },
                { label: 'Anthropic Claude Opus 4.8', value: 'anthropic-claude-opus-4.8' },
                { label: 'Anthropic Claude Fable 5.1', value: 'anthropic-claude-fable-5.1' },
                { label: 'Anthropic Claude Opus 5', value: 'anthropic-claude-opus-5' },
                { label: 'Qwen3 Coder Flash', value: 'qwen3-coder-flash' },
            ]
        case 'dinference':
            return [
                { label: 'GLM-5.2', value: 'glm-5.2' },
                { label: 'GLM-4.7', value: 'glm-4.7' },
                { label: 'MiniMax-M2.5', value: 'minimax-m2.5' },
                { label: 'GLM-5', value: 'glm-5' },
                { label: 'GLM-5.1', value: 'glm-5.1' },
                { label: 'GPT OSS 120B', value: 'gpt-oss-120b' },
            ]
        case 'drun':
            return [
                { label: 'DeepSeek R1', value: 'public/deepseek-r1' },
                { label: 'MiniMax M2.5', value: 'public/minimax-m25' },
                { label: 'DeepSeek V3', value: 'public/deepseek-v3' },
            ]
        case 'edenai':
            return [
                { label: 'Qwen3 Coder Plus', value: 'qwen/qwen3-coder-plus' },
                { label: 'Qwen3 Coder Flash', value: 'qwen/qwen3-coder-flash' },
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
                {
                    label: 'Claude Fable Latest (Claude Fable 5.1)',
                    value: 'anthropic/claude-fable-latest',
                },
                { label: 'Claude Opus 5.5', value: 'anthropic/claude-opus-5-5' },
                { label: 'Claude Opus 5', value: 'anthropic/claude-opus-5' },
                { label: 'Claude Fable 5.1', value: 'anthropic/claude-fable-5-1' },
                { label: 'Claude Opus 4.6', value: 'anthropic/claude-opus-4-6' },
            ]
        case 'empiriolabs':
            return [
                { label: 'Muse Spark 1.2', value: 'muse-spark-1-2' },
                { label: 'Muse Spark 1.1', value: 'muse-spark-1-1' },
                { label: 'Muse Spark 1.3', value: 'muse-spark-1-3' },
                { label: 'Step 5 Preview', value: 'step-5-preview' },
                { label: 'DeepSeek V4 Pro 0813', value: 'deepseek-v4-pro-0813' },
                { label: 'DeepSeek V4 Flash 0731', value: 'deepseek-v4-flash-0731' },
                { label: 'Qwen3.8 Max 0902', value: 'qwen3-8-max-0902' },
                { label: 'Qwen3.7 Plus', value: 'qwen3-7-plus' },
            ]
        case 'evroc':
            return [
                { label: 'Llama-3.3-70B-Instruct', value: 'nvidia/Llama-3.3-70B-Instruct-FP8' },
                { label: 'GLM-5.2', value: 'zai-org/GLM-5.2' },
                { label: 'roc', value: 'evroc/roc' },
                { label: 'Mistral Medium 3.5', value: 'mistralai/Mistral-Medium-3.5-128B' },
                { label: 'Gemma 4 26B A4B IT', value: 'google/gemma-4-26B-A4B-it' },
                { label: 'Qwen3.8-27B', value: 'Qwen/Qwen3.8-27B' },
                { label: 'Qwen3.6 35B-A3B', value: 'Qwen/Qwen3.6-35B-A3B' },
                { label: 'Kimi K2.6', value: 'moonshotai/Kimi-K2.6' },
            ]
        case 'fastrouter':
            return [
                { label: 'Claude Opus 4.8', value: 'anthropic/claude-opus-4.8' },
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4.6' },
                { label: 'Qwen3 Coder', value: 'qwen/qwen3-coder' },
                { label: 'Claude Opus 4.1', value: 'anthropic/claude-opus-4.1' },
                { label: 'Claude Sonnet 4', value: 'anthropic/claude-sonnet-4' },
                { label: 'GPT-5.5 Pro', value: 'openai/gpt-5.5-pro' },
                { label: 'GPT-5.5', value: 'openai/gpt-5.5' },
                { label: 'Gemini 3.1 Pro Preview', value: 'google/gemini-3.1-pro-preview' },
            ]
        case 'friendli':
            return [
                { label: 'GLM-5.3', value: 'zai-org/GLM-5.3' },
                { label: 'GLM-5.2', value: 'zai-org/GLM-5.2' },
                { label: 'GLM-5.3-Flash', value: 'zai-org/GLM-5.3-Flash' },
                { label: 'Gemma 4 31B IT', value: 'google/gemma-4-31B-it' },
                { label: 'GLM-5.1', value: 'zai-org/GLM-5.1' },
                { label: 'MiniMax-M2.5', value: 'MiniMaxAI/MiniMax-M2.5' },
                { label: 'DeepSeek V3.2', value: 'deepseek-ai/DeepSeek-V3.2' },
            ]
        case 'helicone':
            return [
                { label: 'Qwen3 Coder 480B A35B Instruct Turbo', value: 'qwen3-coder' },
                { label: 'Qwen3 Coder 30B A3B Instruct', value: 'qwen3-coder-30b-a3b-instruct' },
                { label: 'Qwen3 Next 80B A3B Instruct', value: 'qwen3-next-80b-a3b-instruct' },
                { label: 'Qwen3 VL 235B A22B Instruct', value: 'qwen3-vl-235b-a22b-instruct' },
                { label: 'Anthropic: Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
                {
                    label: 'Anthropic: Claude Opus 4.1 (20250805)',
                    value: 'claude-opus-4-1-20250805',
                },
                { label: 'Anthropic: Claude Opus 4.5', value: 'claude-4.5-opus' },
                { label: 'Anthropic: Claude 3.5 Sonnet v2', value: 'claude-3.5-sonnet-v2' },
            ]
        case 'hetzner':
            return [
                { label: 'Qwen3.8-27B', value: 'Qwen3.8-27B' },
                { label: 'Qwen3.6 35B A3B FP8', value: 'Qwen/Qwen3.6-35B-A3B-FP8' },
            ]
        case 'hpc-ai':
            return [
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4.7' },
                { label: 'GPT-5.5', value: 'openai/gpt-5.5' },
                { label: 'GLM-5.2', value: 'zai-org/glm-5.2' },
                { label: 'DeepSeek V4 Flash', value: 'deepseek/deepseek-v4-flash' },
                { label: 'DeepSeek V4 Pro', value: 'deepseek/deepseek-v4-pro' },
                { label: 'Kimi K2.7 Code', value: 'moonshotai/kimi-k2.7-code' },
                { label: 'Kimi K2.5', value: 'moonshotai/kimi-k2.5' },
                { label: 'GLM 5.1', value: 'zai-org/glm-5.1' },
            ]
        case 'hyper':
            return [
                { label: 'DeepSeek V4.1 Flash', value: 'deepseek-v4.1-flash' },
                { label: 'Kimi K3', value: 'kimi-k3' },
                { label: 'GLM-5.3-Flash', value: 'glm-5.3-flash' },
                { label: 'Inkling', value: 'inkling' },
                { label: 'Qwen3.7 Max', value: 'qwen3.7-max' },
                { label: 'DeepSeek V4 Pro 0813', value: 'deepseek-v4-pro-0813' },
                { label: 'DeepSeek V4 Flash 0731', value: 'deepseek-v4-flash-0731' },
                { label: 'Qwen3.8 27B', value: 'qwen3.8-27b' },
            ]
        case 'inception':
            return [
                { label: 'Mercury 2.5', value: 'mercury-2.5' },
                { label: 'Mercury 2', value: 'mercury-2' },
                { label: 'Mercury Edit 2', value: 'mercury-edit-2' },
            ]
        case 'inco':
            return [
                { label: 'Kimi K3', value: 'kimi-k3:fast' },
                { label: 'MiniMax-M3', value: 'minimax-m3' },
                { label: 'MiniMax M3 Fast', value: 'minimax-m3:fast' },
                { label: 'DeepSeek V4.1 Flash', value: 'deepseek-v4.1-flash:fast' },
                { label: 'GLM-5.3 Fast', value: 'glm-5.3:fast' },
                { label: 'GLM-5.3-Flash', value: 'glm-5.3-flash:fast' },
                { label: 'GLM-5.3', value: 'glm-5.3' },
            ]
        case 'io-net':
            return [
                {
                    label: 'Llama 4 Maverick 17B 128E Instruct',
                    value: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
                },
                { label: 'Qwen 3 Next 80B Instruct', value: 'Qwen/Qwen3-Next-80B-A3B-Instruct' },
                { label: 'DeepSeek R1', value: 'deepseek-ai/DeepSeek-R1-0528' },
                {
                    label: 'Mistral Large Instruct 2411',
                    value: 'mistralai/Mistral-Large-Instruct-2411',
                },
                {
                    label: 'Mistral Nemo Instruct 2407',
                    value: 'mistralai/Mistral-Nemo-Instruct-2407',
                },
                { label: 'Llama 3.3 70B Instruct', value: 'meta-llama/Llama-3.3-70B-Instruct' },
                {
                    label: 'Qwen 3 Coder 480B',
                    value: 'Intel/Qwen3-Coder-480B-A35B-Instruct-int4-mixed-ar',
                },
                { label: 'Kimi K2 Instruct', value: 'moonshotai/Kimi-K2-Instruct-0905' },
            ]
        case 'iteracompute':
            return [
                { label: 'MiniMax-M3', value: 'minimax/minimax-m3' },
                { label: 'DeepSeek V4 Pro 0813', value: 'deepseek/deepseek-v4-pro-0813' },
                { label: 'Kimi K3', value: 'moonshotai/kimi-k3' },
                { label: 'GLM-5.3-Flash', value: 'z-ai/glm-5.3-flash' },
                { label: 'GLM-5.3', value: 'z-ai/glm-5.3' },
                { label: 'Qwen3.8 2.4T A95B', value: 'qwen/qwen3.8-2.4t-a95b' },
                { label: 'DeepSeek V4 Flash 0731', value: 'deepseek/deepseek-v4-flash-0731' },
                { label: 'Qwen3.8 27B', value: 'qwen/qwen3.8-27b' },
            ]
        case 'kilo':
            return [
                { label: 'Qwen3 Coder Plus', value: 'qwen/qwen3-coder-plus' },
                { label: 'Qwen3 Coder Flash', value: 'qwen/qwen3-coder-flash' },
                {
                    label: 'Anthropic: Claude Fable Latest ($$$$)',
                    value: '~anthropic/claude-fable-latest',
                },
                { label: 'Anthropic: Claude Opus Latest', value: '~anthropic/claude-opus-latest' },
                {
                    label: 'Anthropic: Claude Sonnet Latest',
                    value: '~anthropic/claude-sonnet-latest',
                },
                { label: 'Claude Opus 4.8', value: 'anthropic/claude-opus-4.8' },
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4.7' },
                { label: 'Claude Opus 5', value: 'anthropic/claude-opus-5' },
            ]
        case 'kimi-code-plan-cn':
            return [
                { label: 'kimi-for-coding', value: 'kimi-for-coding' },
                { label: 'Kimi K3', value: 'k3' },
                { label: 'Kimi For Coding HighSpeed', value: 'kimi-for-coding-highspeed' },
                { label: 'Kimi K3-256K', value: 'k3-256k' },
            ]
        case 'kimi-code-plan-global':
            return [
                { label: 'kimi-for-coding', value: 'kimi-for-coding' },
                { label: 'Kimi K3', value: 'k3' },
                { label: 'Kimi For Coding HighSpeed', value: 'kimi-for-coding-highspeed' },
                { label: 'Kimi K3-256K', value: 'k3-256k' },
            ]
        case 'kosmik':
            return [{ label: 'Qwen3.8 27B', value: 'qwen/qwen3.8-27b' }]
        case 'llmgateway':
            return [
                { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
                { label: 'Qwen3 Coder Plus', value: 'qwen3-coder-plus' },
                { label: 'Qwen3 Coder Flash', value: 'qwen3-coder-flash' },
                { label: 'Claude Opus 5.5', value: 'claude-opus-5-5' },
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Fable 5.1', value: 'claude-fable-5-1' },
                { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
                { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
            ]
        case 'merge-gateway':
            return [
                { label: 'Qwen3 Coder Plus', value: 'qwen/qwen3-coder-plus' },
                { label: 'Qwen3 Coder Flash', value: 'qwen/qwen3-coder-flash' },
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
                { label: 'Claude Opus 5.5', value: 'anthropic/claude-opus-5-5' },
                { label: 'Claude Opus 5', value: 'anthropic/claude-opus-5' },
                { label: 'Claude Fable 5.1', value: 'anthropic/claude-fable-5-1' },
                { label: 'Claude Opus 4.6', value: 'anthropic/claude-opus-4-6' },
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4-7' },
            ]
        case 'modal':
            return [
                { label: 'Inkling', value: 'thinkingmachines/Inkling-NVFP4' },
                { label: 'Kimi K3', value: 'moonshotai/Kimi-K3' },
                { label: 'Qwen3.8-Max', value: 'Qwen/Qwen3.8-2.4T-A95B' },
                { label: 'GLM 5.3 Flash', value: 'zai-org/GLM-5.3-Flash' },
            ]
        case 'modelscope':
            return [
                { label: 'Qwen3 30B A3B Instruct 2507', value: 'Qwen/Qwen3-30B-A3B-Instruct-2507' },
                {
                    label: 'Qwen3 Coder 30B A3B Instruct',
                    value: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
                },
                {
                    label: 'Qwen3 235B A22B Instruct 2507',
                    value: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
                },
                {
                    label: 'Qwen3-235B-A22B-Thinking-2507',
                    value: 'Qwen/Qwen3-235B-A22B-Thinking-2507',
                },
                { label: 'Qwen3 30B A3B Thinking 2507', value: 'Qwen/Qwen3-30B-A3B-Thinking-2507' },
                { label: 'GLM-4.6', value: 'ZhipuAI/GLM-4.6' },
                { label: 'GLM-4.5', value: 'ZhipuAI/GLM-4.5' },
            ]
        case 'morph':
            return [
                { label: 'Morph v3 Large', value: 'morph-v3-large' },
                { label: 'Auto', value: 'auto' },
                { label: 'Morph v3 Fast', value: 'morph-v3-fast' },
            ]
        case 'nano-gpt':
            return [
                { label: 'GPT Chat Latest', value: 'openai/gpt-chat-latest' },
                { label: 'Claude Opus 4.8', value: 'anthropic/claude-opus-4.8' },
                {
                    label: 'Claude 4 Sonnet Thinking (8K)',
                    value: 'anthropic/claude-sonnet-4:thinking:8192',
                },
                { label: 'Claude 4.6 Opus Thinking', value: 'anthropic/claude-opus-4.6:thinking' },
                {
                    label: 'Claude 4 Sonnet Thinking (1K)',
                    value: 'anthropic/claude-sonnet-4:thinking:1024',
                },
                { label: 'Claude Fable Latest', value: 'anthropic/claude-fable-latest' },
                { label: 'Claude 4.7 Opus', value: 'anthropic/claude-opus-4.7' },
                { label: 'Claude Opus 5', value: 'anthropic/claude-opus-5' },
            ]
        case 'nearai':
            return [
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4-7' },
                { label: 'Claude Opus 4.6', value: 'anthropic/claude-opus-4-6' },
                { label: 'Claude Haiku 4.5 (latest)', value: 'anthropic/claude-haiku-4-5' },
                { label: 'Claude Sonnet 4.5 (latest)', value: 'anthropic/claude-sonnet-4-5' },
                { label: 'Qwen3-VL 30B-A3B Instruct', value: 'Qwen/Qwen3-VL-30B-A3B-Instruct' },
                { label: 'GPT-5.4', value: 'openai/gpt-5.4' },
                { label: 'GPT-5.5', value: 'openai/gpt-5.5' },
            ]
        case 'nebius':
            return [
                { label: 'Qwen3-30B-A3B-Instruct-2507', value: 'Qwen/Qwen3-30B-A3B-Instruct-2507' },
                {
                    label: 'Qwen3 235B A22B Instruct 2507',
                    value: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
                },
                { label: 'DeepSeek V4 Pro', value: 'deepseek-ai/DeepSeek-V4-Pro' },
                { label: 'Nemotron 3.5 Lightning 30B A3B', value: 'nvidia/Nemotron-3_5-Lightning' },
                { label: 'Nemotron 3 Ultra 550B A55B', value: 'nvidia/Nemotron-3-Ultra-550b-a55b' },
                { label: 'GLM-5.2', value: 'zai-org/GLM-5.2' },
                { label: 'MiniMax-M3', value: 'MiniMaxAI/MiniMax-M3' },
                { label: 'Kimi K3', value: 'moonshotai/Kimi-K3' },
            ]
        case 'novita-ai':
            return [
                { label: 'Qwen3 Coder Next', value: 'qwen/qwen3-coder-next' },
                {
                    label: 'Qwen3 Coder 480B A35B Instruct',
                    value: 'qwen/qwen3-coder-480b-a35b-instruct',
                },
                { label: 'Kat Coder Pro', value: 'kwaipilot/kat-coder-pro' },
                { label: 'DeepSeek R1 0528', value: 'deepseek/deepseek-r1-0528' },
                {
                    label: 'Qwen3 Coder 30b A3B Instruct',
                    value: 'qwen/qwen3-coder-30b-a3b-instruct',
                },
                { label: 'Qwen3 Next 80B A3B Instruct', value: 'qwen/qwen3-next-80b-a3b-instruct' },
                { label: 'qwen/qwen3-vl-8b-instruct', value: 'qwen/qwen3-vl-8b-instruct' },
                {
                    label: 'qwen/qwen3-vl-30b-a3b-instruct',
                    value: 'qwen/qwen3-vl-30b-a3b-instruct',
                },
            ]
        case 'opencode':
            return [
                { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
                { label: 'Claude Opus 5.5', value: 'claude-opus-5-5' },
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Fable 5.1', value: 'claude-fable-5-1' },
                { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
                { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
                { label: 'Claude Fable 5', value: 'claude-fable-5' },
                { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5' },
            ]
        case 'opencode-go':
            return [
                { label: 'GPT-5.6 Luna', value: 'gpt-5.6-luna' },
                { label: 'Muse Spark 1.2 Contributor', value: 'muse-spark-1.2-contributor' },
                { label: 'MiMo-V2.6-Pro', value: 'mimo-v2.6-pro' },
                { label: 'Kimi K3', value: 'kimi-k3' },
                { label: 'Muse Spark 1.3 Contributor', value: 'muse-spark-1.3-contributor' },
                { label: 'MiMo V2 Pro', value: 'mimo-v2-pro' },
                { label: 'MiMo-V2.6-Flash', value: 'mimo-v2.6-flash' },
                { label: 'MiMo V2.5 Pro', value: 'mimo-v2.5-pro' },
            ]
        case 'openreason':
            return [
                { label: 'DeepSeek V4 Flash 0731', value: 'deepseek-ai/deepseek-v4-flash-0731' },
                { label: 'Kimi K2.7 Code', value: 'moonshotai/kimi-k2.7-code' },
                { label: 'GPT OSS 120B', value: 'openai/gpt-oss-120b' },
            ]
        case 'opper':
            return [
                { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Fable 5.1', value: 'claude-fable-5-1' },
                { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
                { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
                { label: 'Claude Fable 5', value: 'claude-fable-5' },
                { label: 'Claude Opus 4.8', value: 'claude-opus-4-8' },
                { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
            ]
        case 'orcarouter':
            return [
                { label: 'Claude Opus 4.8', value: 'anthropic/claude-opus-4.8' },
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4.7' },
                { label: 'Claude Opus 5', value: 'anthropic/claude-opus-5' },
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4.6' },
                { label: 'Claude Opus 4.6', value: 'anthropic/claude-opus-4.6' },
                { label: 'Claude Fable 5', value: 'anthropic/claude-fable-5' },
                { label: 'Claude Sonnet 4.5 (latest)', value: 'anthropic/claude-sonnet-4.5' },
                { label: 'Claude Sonnet 5', value: 'anthropic/claude-sonnet-5' },
            ]
        case 'ovhcloud':
            return [
                { label: 'Qwen3-Coder-30B-A3B-Instruct', value: 'qwen3-coder-30b-a3b-instruct' },
                {
                    label: 'Mistral-Small-3.2-24B-Instruct-2506',
                    value: 'mistral-small-3.2-24b-instruct-2506',
                },
                { label: 'Meta-Llama-3_3-70B-Instruct', value: 'meta-llama-3_3-70b-instruct' },
                { label: 'Mistral-Nemo-Instruct-2407', value: 'mistral-nemo-instruct-2407' },
                { label: 'Mistral-7B-Instruct-v0.3', value: 'mistral-7b-instruct-v0.3' },
                { label: 'Qwen3.5-9B', value: 'qwen3.5-9b' },
                { label: 'Qwen3.8-27B', value: 'qwen3.8-27b' },
                { label: 'Qwen3.5-397B-A17B', value: 'qwen3.5-397b-a17b' },
            ]
        case 'pendra':
            return [
                { label: 'Qwen3-Coder 30B-A3B Instruct', value: 'qwen3-coder:30b' },
                { label: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash' },
                { label: 'Qwen3.6 27B', value: 'qwen3.6:27b' },
                { label: 'GLM-4.7-Flash', value: 'glm-4.7-flash' },
                { label: 'GPT OSS 120B', value: 'gpt-oss:120b' },
                { label: 'Llama-3.3-70B-Instruct', value: 'llama3.3:70b' },
            ]
        case 'perplexity-agent':
            return [
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4-7' },
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
                { label: 'Claude Opus 4.5', value: 'anthropic/claude-opus-4-5' },
                { label: 'Claude Opus 4.6', value: 'anthropic/claude-opus-4-6' },
                { label: 'Claude Haiku 4.5', value: 'anthropic/claude-haiku-4-5' },
                { label: 'Claude Sonnet 4.5', value: 'anthropic/claude-sonnet-4-5' },
                {
                    label: 'Grok 4.1 Fast (Non-Reasoning)',
                    value: 'xai/grok-4-1-fast-non-reasoning',
                },
                { label: 'GPT-5.4', value: 'openai/gpt-5.4' },
            ]
        case 'poe':
            return [
                { label: 'Claude-Opus-4.8', value: 'anthropic/claude-opus-4.8' },
                { label: 'Claude-Opus-4.7', value: 'anthropic/claude-opus-4.7' },
                { label: 'Claude-Sonnet-4.6', value: 'anthropic/claude-sonnet-4.6' },
                { label: 'Claude-Opus-4.6', value: 'anthropic/claude-opus-4.6' },
                { label: 'Claude-Sonnet-4.5', value: 'anthropic/claude-sonnet-4.5' },
                { label: 'Claude-Sonnet-4', value: 'anthropic/claude-sonnet-4' },
                { label: 'Claude-Sonnet-3.7', value: 'anthropic/claude-sonnet-3.7' },
                { label: 'Claude-Opus-4.1', value: 'anthropic/claude-opus-4.1' },
            ]
        case 'qiniu-ai':
            return [
                { label: 'Qwen3 235b A22B Instruct 2507', value: 'qwen3-235b-a22b-instruct-2507' },
                {
                    label: 'Qwen3 Coder 480B A35B Instruct',
                    value: 'qwen3-coder-480b-a35b-instruct',
                },
                { label: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet' },
                { label: 'Claude 4.5 Opus', value: 'claude-4.5-opus' },
                { label: 'Claude 4.0 Opus', value: 'claude-4.0-opus' },
                { label: 'Claude 4.1 Opus', value: 'claude-4.1-opus' },
                { label: 'Claude 3.5 Haiku', value: 'claude-3.5-haiku' },
                { label: 'Claude 3.7 Sonnet', value: 'claude-3.7-sonnet' },
            ]
        case 'regolo-ai':
            return [
                { label: 'Qwen3-Coder-Next', value: 'qwen3-coder-next' },
                { label: 'Llama 3.3 70B Instruct', value: 'llama-3.3-70b-instruct' },
                { label: 'Qwen3.5-9B', value: 'qwen3.5-9b' },
                { label: 'Qwen3.5-122B', value: 'qwen3.5-122b' },
                { label: 'Mistral Small 4 119B', value: 'mistral-small-4-119b' },
                { label: 'GPT-OSS-20B', value: 'gpt-oss-20b' },
                { label: 'GPT-OSS-120B', value: 'gpt-oss-120b' },
                { label: 'Qwen3.8 27B', value: 'qwen3.8-27b' },
            ]
        case 'requesty':
            return [
                { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
                { label: 'Claude Opus 4.7 (EU)', value: 'claude-opus-4-7@eu' },
                { label: 'Claude Opus 5.5', value: 'claude-opus-5-5' },
                { label: 'Claude Fable 5.1 (EU)', value: 'claude-fable-5.1@eu' },
                { label: 'Claude Opus 4.6 (EU)', value: 'claude-opus-4-6@eu' },
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Sonnet 5 (EU)', value: 'claude-sonnet-5@eu' },
                { label: 'Claude Fable 5 (EU)', value: 'claude-fable-5@eu' },
            ]
        case 'runinfra':
            return [
                { label: 'DeepSeek V4 Flash 0731', value: 'deepseek-ai/DeepSeek-V4-Flash-0731' },
                { label: 'DeepSeek V4 Pro 0813', value: 'deepseek-ai/DeepSeek-V4-Pro-0813' },
                { label: 'GLM-5.3-Flash', value: 'zai-org/GLM-5.3-Flash' },
                { label: 'Ornith 1.5 35B A3B', value: 'ornith-ai/Ornith-1.5-35B-A3B' },
                { label: 'Qwen3.8 2.4T A95B (NVFP4)', value: 'Inferact/Qwen3.8-2.4T-A95B-NVFP4' },
                {
                    label: 'Nemotron 3.5 Lightning 30B A3B',
                    value: 'nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16',
                },
                { label: 'Qwen3.8 27B', value: 'Qwen/Qwen3.8-27B' },
            ]
        case 'salad-cloud':
            return [{ label: 'Qwen3.6 35B-A3B', value: 'qwen3.6-35b-a3b' }]
        case 'scaleway':
            return [
                { label: 'Qwen3 235B A22B Instruct 2507', value: 'qwen3-235b-a22b-instruct-2507' },
                { label: 'Qwen3-Coder 30B-A3B Instruct', value: 'qwen3-coder-30b-a3b-instruct' },
                {
                    label: 'Mistral Small 3.2 24B Instruct (2506)',
                    value: 'mistral-small-3.2-24b-instruct-2506',
                },
                { label: 'Llama-3.3-70B-Instruct', value: 'llama-3.3-70b-instruct' },
                { label: 'Gemma 4 26B A4B IT', value: 'gemma-4-26b-a4b-it' },
                { label: 'DeepSeek V4 Flash 0731', value: 'deepseek-v4-flash-0731' },
                { label: 'GLM-5.2', value: 'glm-5.2' },
                { label: 'Qwen3.5 397B A17B', value: 'qwen3.5-397b-a17b' },
            ]
        case 'stackit':
            return [
                { label: 'Qwen3-VL 235B', value: 'Qwen/Qwen3-VL-235B-A22B-Instruct-FP8' },
                { label: 'Llama 3.3 70B', value: 'cortecs/Llama-3.3-70B-Instruct-FP8-Dynamic' },
                { label: 'Qwen3.6 27B', value: 'Qwen/Qwen3.6-27B' },
                { label: 'GPT OSS 20B', value: 'openai/gpt-oss-20b' },
                { label: 'GPT OSS 120B', value: 'openai/gpt-oss-120b' },
                { label: 'E5 Mistral 7B', value: 'intfloat/e5-mistral-7b-instruct' },
                { label: 'Gemma 3 27B', value: 'google/gemma-3-27b-it' },
                { label: 'Qwen3-VL Embedding 8B', value: 'Qwen/Qwen3-VL-Embedding-8B' },
            ]
        case 'standardcompute':
            return [{ label: 'Standard Compute', value: 'standardcompute' }]
        case 'subconscious':
            return [
                { label: 'GLM-5.2', value: 'subconscious/glm-5.2' },
                { label: 'TIM-Qwen3.6 27B', value: 'subconscious/tim-qwen3.6-27b' },
            ]
        case 'synthetic':
            return [
                { label: 'DeepSeek V4.1 Flash', value: 'hf:deepseek-ai/DeepSeek-V4.1-Flash' },
                { label: 'MiniMax-M3', value: 'hf:MiniMaxAI/MiniMax-M3' },
                { label: 'Kimi K3', value: 'hf:moonshotai/Kimi-K3' },
                { label: 'GLM-5.2', value: 'hf:zai-org/GLM-5.2' },
                { label: 'GLM-5.3-Flash', value: 'hf:zai-org/GLM-5.3-Flash' },
                { label: 'Kimi K2.7 Code', value: 'hf:moonshotai/Kimi-K2.7-Code' },
                { label: 'Qwen3.6 27B', value: 'hf:Qwen/Qwen3.6-27B' },
                {
                    label: 'Nemotron 3 Super 120B A12B',
                    value: 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
                },
            ]
        case 'tencent-tokenhub':
            return [
                { label: 'Hy4 preview', value: 'hy4-preview' },
                { label: 'Hy3', value: 'hy3' },
                { label: 'Hy3 preview', value: 'hy3-preview' },
            ]
        case 'the-grid-ai':
            return [
                { label: 'Agent Max', value: 'agent-max' },
                { label: 'Text Max', value: 'text-max' },
                { label: 'Code Max', value: 'code-max' },
                { label: 'Agent Prime', value: 'agent-prime' },
                { label: 'Code Prime', value: 'code-prime' },
                { label: 'Text Prime', value: 'text-prime' },
                { label: 'Text Standard', value: 'text-standard' },
                { label: 'Code Standard', value: 'code-standard' },
            ]
        case 'tinfoil':
            return [
                { label: 'DeepSeek V4.1 Flash', value: 'deepseek-v4-1-flash' },
                { label: 'GLM-5.3', value: 'glm-5-3' },
                { label: 'GLM-5.3-Flash', value: 'glm-5-3-flash' },
                { label: 'Gemma 4 31B IT', value: 'gemma4-31b' },
                { label: 'Kimi K3', value: 'kimi-k3' },
                { label: 'gpt-oss-safeguard-120b', value: 'gpt-oss-safeguard-120b' },
                { label: 'gpt-oss-120b', value: 'gpt-oss-120b' },
                { label: 'Llama-3.3-70B-Instruct', value: 'llama3-3-70b' },
            ]
        case 'venice':
            return [
                { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
                { label: 'Claude Opus 5.5', value: 'claude-opus-5-5' },
                { label: 'Claude Opus 5 Fast', value: 'claude-opus-5-fast' },
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Fable 5.1', value: 'claude-fable-5-1' },
                { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
                { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
                { label: 'Claude Fable 5', value: 'claude-fable-5' },
            ]
        case 'vercel':
            return [
                { label: 'Qwen3 Coder Plus', value: 'alibaba/qwen3-coder-plus' },
                { label: 'Claude Opus 4.8', value: 'anthropic/claude-opus-4.8' },
                { label: 'Claude Opus 5 (Fast)', value: 'anthropic/claude-opus-5-fast' },
                { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4.7' },
                { label: 'Claude Opus 5', value: 'anthropic/claude-opus-5' },
                { label: 'Claude Opus 5.5 (Fast)', value: 'anthropic/claude-opus-5.5-fast' },
                { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4.6' },
                { label: 'Claude Opus 5.5', value: 'anthropic/claude-opus-5.5' },
            ]
        case 'vivgrid':
            return [
                { label: 'Claude Opus 5', value: 'claude-opus-5' },
                { label: 'Claude Fable 5.1', value: 'claude-fable-5-1' },
                { label: 'Claude Fable 5', value: 'claude-fable-5' },
                { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
                { label: 'GPT 5.6 Sol', value: 'gpt-5.6-sol' },
                { label: 'GPT-6 Astra', value: 'gpt-6-astra' },
                { label: 'GPT 5.6 Luna', value: 'gpt-5.6-luna' },
                { label: 'GPT 5.6 Terra', value: 'gpt-5.6-terra' },
            ]
        case 'volcengine':
            return [
                { label: 'DeepSeek V4 Pro 0813', value: 'deepseek-v4-pro-ga-260813' },
                { label: 'GLM-5.2', value: 'glm-5-2-260617' },
                { label: 'GLM-5.3-Flash', value: 'glm-5-3-flash-260828' },
                { label: 'DeepSeek V4 Flash 0731', value: 'deepseek-v4-flash-ga-260731' },
                { label: 'Seed 2.0 Code', value: 'doubao-seed-2-0-code-preview-260215' },
                { label: 'Seed 2.0 Lite', value: 'doubao-seed-2-0-lite-260428' },
                { label: 'Seed Character', value: 'doubao-seed-character-260628' },
                { label: 'Seed 2.0 Mini', value: 'doubao-seed-2-0-mini-260428' },
            ]
        case 'vultr':
            return [
                { label: 'MiMo-V2.5-Pro', value: 'XiaomiMiMo/MiMo-V2.5-Pro' },
                { label: 'DeepSeek V4 Flash', value: 'deepseek-ai/DeepSeek-V4-Flash' },
                { label: 'GLM-5.2', value: 'zai-org/GLM-5.2-FP8' },
                {
                    label: 'NVIDIA Nemotron 3 Nano Omni',
                    value: 'nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16',
                },
                { label: 'NVIDIA Nemotron Cascade 2', value: 'nvidia/Nemotron-Cascade-2-30B-A3B' },
                { label: 'Qwen3.5 397B-A17B', value: 'Qwen/Qwen3.5-397B-A17B' },
                { label: 'Qwen3.6 27B', value: 'Qwen/Qwen3.6-27B' },
                { label: 'Kimi K2.6', value: 'moonshotai/Kimi-K2.6' },
            ]
        case 'wafer.ai':
            return [
                { label: 'GLM5.2-Fast', value: 'glm5.2-fast' },
                { label: 'GLM-5.2', value: 'GLM-5.2' },
                { label: 'MiniMax-M3', value: 'MiniMax-M3' },
                { label: 'Kimi K2.6', value: 'Kimi-K2.6' },
                { label: 'GLM-5.1', value: 'GLM-5.1' },
            ]
        case 'watsonx':
            return [
                {
                    label: 'Mistral Small 3.1 24B',
                    value: 'mistralai/mistral-small-3-1-24b-instruct-2503',
                },
                {
                    label: 'Llama 4 Maverick 17B 128E Instruct FP8',
                    value: 'meta-llama/llama-4-maverick-17b-128e-instruct-fp8',
                },
                { label: 'Llama-3.3-70B-Instruct', value: 'meta-llama/llama-3-3-70b-instruct' },
                { label: 'Granite-4.0-H-Small', value: 'ibm/granite-4-h-small' },
                { label: 'GPT OSS 120B', value: 'openai/gpt-oss-120b' },
            ]
        case 'dashscope':
        case 'qwen':
            return [
                { label: 'Qwen 3.8 Max', value: 'qwen3.8-max' },
                { label: 'Qwen 3.8 Flash Next', value: 'qwen3.8-flash-next' },
                { label: 'Qwen 3.7 Max', value: 'qwen3.7-max' },
                { label: 'Qwen 3 Coder 30B', value: 'qwen3-coder-30b-a3b-instruct' },
                { label: 'Qwen Max Latest', value: 'qwen-max-latest' },
                { label: 'Qwen Plus Latest', value: 'qwen-plus-latest' },
                { label: 'Qwen Turbo Latest', value: 'qwen-turbo-latest' },
                { label: 'Qwen 2.5 Coder 32B', value: 'qwen2.5-coder-32b-instruct' },
                { label: 'Qwen 2.5 Coder 7B', value: 'qwen2.5-coder-7b-instruct' },
            ]
        case 'lmstudio':
            return [{ label: 'Local LM Studio Model', value: 'default' }]
        case 'llamacpp':
            return [{ label: 'Local llama.cpp Model', value: 'default' }]
        case 'ollama':
            return [
                { label: 'Qwen 2.5 Coder 7B', value: 'qwen2.5-coder:7b' },
                { label: 'Qwen 2.5 Coder 14B', value: 'qwen2.5-coder:14b' },
                { label: 'Qwen 2.5 Coder 32B', value: 'qwen2.5-coder:32b' },
                { label: 'Llama 3.3 70B', value: 'llama3.3:70b' },
                { label: 'Llama 3.1 8B', value: 'llama3.1:8b' },
                { label: 'Mistral Nemo 12B', value: 'mistral-nemo:latest' },
            ]
        default:
            return [{ label: 'Default', value: 'default' }]
    }
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

export const isToolCompatibleOllamaModel = (modelName: string): boolean => {
    if (!modelName) return false
    const lower = modelName.toLowerCase()
    const toolKeywords = [
        'qwen2.5-coder',
        'qwen2.5',
        'llama-3.3',
        'llama3.3',
        'llama-3.1',
        'llama3.1',
        'mistral-nemo',
        'codellama',
        'command-r',
        'hermes3',
        'firefunction',
    ]
    return toolKeywords.some((kw) => lower.includes(kw))
}

function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B'
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

export async function fetchOllamaModels(
    baseUrl: string = 'http://localhost:11434',
    fetchFn: typeof fetch = fetch
): Promise<{ label: string; value: string }[]> {
    try {
        const cleanBaseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
        const res = await fetchFn(`${cleanBaseUrl}/api/tags`)
        if (!res.ok) {
            return getProviderModels('ollama')
        }
        const data = (await res.json()) as { models?: { name: string; size: number }[] }
        if (!data.models || data.models.length === 0) {
            return getProviderModels('ollama')
        }
        const filtered = data.models.filter((m) => isToolCompatibleOllamaModel(m.name))
        if (filtered.length === 0) {
            return getProviderModels('ollama')
        }
        return filtered.map((m) => ({
            label: `${m.name} (${formatBytes(m.size)})`,
            value: m.name,
        }))
    } catch {
        // Fallback to curated tool-compatible models on network error
        return getProviderModels('ollama')
    }
}

export async function checkOllamaStatus(
    baseUrl: string = 'http://localhost:11434',
    fetchFn: typeof fetch = fetch
): Promise<{ running: boolean; models: string[]; compatibleModels: string[]; error?: string }> {
    try {
        const cleanBaseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
        const res = await fetchFn(`${cleanBaseUrl}/api/tags`)
        if (!res.ok) {
            return {
                running: false,
                models: [],
                compatibleModels: [],
                error: `HTTP error: ${res.status} ${res.statusText}`,
            }
        }
        const data = (await res.json()) as { models?: { name: string; size: number }[] }
        const allModels = (data.models || []).map((m) => m.name)
        const compatible = allModels.filter((name) => isToolCompatibleOllamaModel(name))
        return {
            running: true,
            models: allModels,
            compatibleModels: compatible,
        }
    } catch (err: any) {
        return {
            running: false,
            models: [],
            compatibleModels: [],
            error: err?.message || String(err),
        }
    }
}

export function getDefaultUrlForLocalProvider(provider: string): string {
    const normalized = (provider || '').toLowerCase()
    if (normalized === 'lmstudio') return 'http://localhost:1234'
    if (normalized === 'llamacpp') return 'http://localhost:8080'
    return 'http://localhost:11434'
}

export async function checkLocalServerStatus(
    provider: string,
    baseUrl?: string,
    fetchFn: typeof fetch = fetch
): Promise<{
    running: boolean
    models: string[]
    compatibleModels: string[]
    error?: string
}> {
    const normalized = (provider || '').toLowerCase()
    const defaultUrl = getDefaultUrlForLocalProvider(normalized)
    const url = baseUrl || defaultUrl

    if (normalized === 'ollama') {
        return checkOllamaStatus(url, fetchFn)
    }

    try {
        const cleanBaseUrl = url.replace(/\/+$/, '')
        const endpoint = cleanBaseUrl.endsWith('/v1')
            ? `${cleanBaseUrl}/models`
            : `${cleanBaseUrl}/v1/models`
        const res = await fetchFn(endpoint, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(3000),
        })

        if (!res.ok) {
            return {
                running: false,
                models: [],
                compatibleModels: [],
                error: `HTTP error: ${res.status} ${res.statusText}`,
            }
        }

        const data = (await res.json()) as { data?: { id: string }[] }
        const allModels = (data.data || []).map((m) => m.id)
        const compatible = allModels.filter((name) => isToolCompatibleOllamaModel(name))
        return {
            running: true,
            models: allModels,
            compatibleModels: compatible.length > 0 ? compatible : allModels,
        }
    } catch (err: any) {
        return {
            running: false,
            models: [],
            compatibleModels: [],
            error: err?.message || String(err),
        }
    }
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

    if (normalized === 'ollama') {
        const defaultUrl = getDefaultUrlForLocalProvider('ollama')
        const url = baseUrl || defaultUrl
        return fetchOllamaModels(url, fetchFn)
    }

    if (normalized === 'lmstudio' || normalized === 'llamacpp') {
        const status = await checkLocalServerStatus(normalized, baseUrl, fetchFn)
        if (status.running && status.compatibleModels.length > 0) {
            return status.compatibleModels.map((id) => ({
                label: id === 'default' ? getModelLabel('default') : formatModelLabel(id),
                value: id,
            }))
        }
        return curated
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
        'lmstudio',
        'llamacpp',
        'ollama',
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
    if (normalized === 'ollama') return isToolCompatibleOllamaModel(model)

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
    if (normalized === '302ai') {
        return 'claude-sonnet-4-6'
    }
    if (normalized === 'abacus') {
        return 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'
    }
    if (normalized === 'above') {
        return 'mimo-v2.5-pro'
    }
    if (normalized === 'ai21') {
        return 'jamba-large'
    }
    if (normalized === 'amd') {
        return 'DeepSeek-V4-Flash'
    }
    if (normalized === 'ambient') {
        return 'ambient/large'
    }
    if (normalized === 'anyapi') {
        return 'anthropic/claude-sonnet-4-6'
    }
    if (normalized === 'auriko' || normalized === 'aurikoai' || normalized === 'auriko-ai') {
        return 'deepseek-v4-flash'
    }
    if (normalized === 'baseten' || normalized === 'basetenco' || normalized === 'baseten-co') {
        return 'deepseek-ai/DeepSeek-V4.1-Flash'
    }
    if (normalized === 'berget') {
        return 'mistralai/Mistral-Small-3.2-24B-Instruct-2506'
    }
    if (normalized === 'blueclaw') {
        return 'Qwen3.6-27B'
    }
    if (normalized === 'chutes') {
        return 'deepseek-ai/DeepSeek-V4-Flash-0731-TEE'
    }
    if (normalized === 'clarifai') {
        return 'qwen/qwenCoder/models/Qwen3-Coder-30B-A3B-Instruct'
    }
    if (normalized === 'cloudferro-sherlock') {
        return 'meta-llama/Llama-3.3-70B-Instruct'
    }
    if (normalized === 'cloudflare-ai-gateway') {
        return 'anthropic/claude-opus-4.8'
    }
    if (normalized === 'coralbricks') {
        return 'glm-5.3-flash-fp4'
    }
    if (normalized === 'cortecs') {
        return 'claude-opus-5'
    }
    if (normalized === 'crusoe') {
        return 'Qwen/Qwen3-235B-A22B-Instruct-2507'
    }
    if (normalized === 'deepinfra') {
        return 'meta-llama/Llama-4-Scout-17B-16E-Instruct'
    }
    if (normalized === 'digitalocean') {
        return 'anthropic-claude-fable-5'
    }
    if (normalized === 'dinference') {
        return 'glm-5.2'
    }
    if (normalized === 'drun') {
        return 'public/deepseek-r1'
    }
    if (normalized === 'edenai') {
        return 'qwen/qwen3-coder-plus'
    }
    if (normalized === 'empiriolabs') {
        return 'muse-spark-1-2'
    }
    if (normalized === 'evroc') {
        return 'nvidia/Llama-3.3-70B-Instruct-FP8'
    }
    if (normalized === 'fastrouter') {
        return 'anthropic/claude-opus-4.8'
    }
    if (normalized === 'friendli') {
        return 'zai-org/GLM-5.3'
    }
    if (normalized === 'helicone') {
        return 'qwen3-coder'
    }
    if (normalized === 'hetzner') {
        return 'Qwen3.8-27B'
    }
    if (normalized === 'hpc-ai') {
        return 'anthropic/claude-opus-4.7'
    }
    if (normalized === 'hyper') {
        return 'deepseek-v4.1-flash'
    }
    if (normalized === 'inception') {
        return 'mercury-2.5'
    }
    if (normalized === 'inco') {
        return 'kimi-k3:fast'
    }
    if (normalized === 'io-net') {
        return 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'
    }
    if (normalized === 'iteracompute') {
        return 'minimax/minimax-m3'
    }
    if (normalized === 'kilo') {
        return 'qwen/qwen3-coder-plus'
    }
    if (normalized === 'kimi-code-plan-cn') {
        return 'kimi-for-coding'
    }
    if (normalized === 'kimi-code-plan-global') {
        return 'kimi-for-coding'
    }
    if (normalized === 'kosmik') {
        return 'qwen/qwen3.8-27b'
    }
    if (normalized === 'llmgateway') {
        return 'claude-sonnet-4-6'
    }
    if (normalized === 'merge-gateway') {
        return 'qwen/qwen3-coder-plus'
    }
    if (normalized === 'mistral' || normalized === 'mistralai' || normalized === 'mistral-ai') {
        return 'mistral-large-latest'
    }
    if (normalized === 'modal') {
        return 'thinkingmachines/Inkling-NVFP4'
    }
    if (normalized === 'modelscope') {
        return 'Qwen/Qwen3-30B-A3B-Instruct-2507'
    }
    if (normalized === 'morph') {
        return 'morph-v3-large'
    }
    if (normalized === 'nano-gpt') {
        return 'openai/gpt-chat-latest'
    }
    if (normalized === 'nearai') {
        return 'anthropic/claude-sonnet-4-6'
    }
    if (normalized === 'nebius') {
        return 'Qwen/Qwen3-30B-A3B-Instruct-2507'
    }
    if (normalized === 'novita-ai') {
        return 'qwen/qwen3-coder-next'
    }
    if (normalized === 'opencode') {
        return 'claude-sonnet-4-6'
    }
    if (normalized === 'opencode-go') {
        return 'gpt-5.6-luna'
    }
    if (normalized === 'openreason') {
        return 'deepseek-ai/deepseek-v4-flash-0731'
    }
    if (normalized === 'opper') {
        return 'claude-sonnet-4-6'
    }
    if (normalized === 'orcarouter') {
        return 'anthropic/claude-opus-4.8'
    }
    if (normalized === 'ovhcloud') {
        return 'qwen3-coder-30b-a3b-instruct'
    }
    if (normalized === 'pendra') {
        return 'qwen3-coder:30b'
    }
    if (normalized === 'perplexity-agent') {
        return 'anthropic/claude-opus-4-7'
    }
    if (normalized === 'poe') {
        return 'anthropic/claude-opus-4.8'
    }
    if (normalized === 'qiniu-ai') {
        return 'qwen3-235b-a22b-instruct-2507'
    }
    if (normalized === 'regolo-ai') {
        return 'qwen3-coder-next'
    }
    if (normalized === 'requesty') {
        return 'claude-sonnet-4-6'
    }
    if (normalized === 'runinfra') {
        return 'deepseek-ai/DeepSeek-V4-Flash-0731'
    }
    if (normalized === 'salad-cloud') {
        return 'qwen3.6-35b-a3b'
    }
    if (normalized === 'scaleway') {
        return 'qwen3-235b-a22b-instruct-2507'
    }
    if (normalized === 'stackit') {
        return 'Qwen/Qwen3-VL-235B-A22B-Instruct-FP8'
    }
    if (normalized === 'standardcompute') {
        return 'standardcompute'
    }
    if (normalized === 'subconscious') {
        return 'subconscious/glm-5.2'
    }
    if (normalized === 'synthetic') {
        return 'hf:deepseek-ai/DeepSeek-V4.1-Flash'
    }
    if (normalized === 'tencent-tokenhub') {
        return 'hy4-preview'
    }
    if (normalized === 'the-grid-ai') {
        return 'agent-max'
    }
    if (normalized === 'tinfoil') {
        return 'deepseek-v4-1-flash'
    }
    if (normalized === 'venice') {
        return 'claude-sonnet-4-6'
    }
    if (normalized === 'vercel') {
        return 'alibaba/qwen3-coder-plus'
    }
    if (normalized === 'vivgrid') {
        return 'claude-opus-5'
    }
    if (normalized === 'volcengine') {
        return 'deepseek-v4-pro-ga-260813'
    }
    if (normalized === 'vultr') {
        return 'XiaomiMiMo/MiMo-V2.5-Pro'
    }
    if (normalized === 'wafer.ai') {
        return 'glm5.2-fast'
    }
    if (normalized === 'watsonx') {
        return 'mistralai/mistral-small-3-1-24b-instruct-2503'
    }
    if (normalized === 'ollama') {
        return 'qwen2.5-coder:7b'
    }
    if (normalized === 'lmstudio' || normalized === 'llamacpp') {
        return 'default'
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
