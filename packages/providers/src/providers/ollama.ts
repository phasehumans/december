import { openaiProvider } from './openai.ts'

import type { LLMProvider } from '../types.ts'

export const OLLAMA_DEFAULT_HOST = 'http://localhost:11434'
export const OLLAMA_DEFAULT_BASE_URL = `${OLLAMA_DEFAULT_HOST}/v1`

/**
 * Normalizes an Ollama base URL to its OpenAI-compatible `/v1` root.
 * Accepts `http://localhost:11434`, `http://localhost:11434/`, or `http://localhost:11434/v1`.
 */
export function normalizeOllamaBaseUrl(baseUrl?: string): string {
    const trimmed = (baseUrl || '').trim().replace(/\/+$/, '')
    if (!trimmed) return OLLAMA_DEFAULT_BASE_URL
    if (/\/v1$/i.test(trimmed)) return trimmed
    return `${trimmed}/v1`
}

/**
 * Derives the native Ollama HTTP origin (without `/v1`) for `/api/tags` and `/api/show`.
 */
export function getOllamaApiOrigin(baseUrl?: string): string {
    const normalized = normalizeOllamaBaseUrl(baseUrl)
    return normalized.replace(/\/v1$/i, '')
}

/**
 * Extracts the context window from Ollama's `/api/show` JSON payload.
 * Prefers an explicit `num_ctx` parameter when set, else the model's `*.context_length`.
 */
export function parseOllamaContextWindow(showJson: unknown): number | undefined {
    if (!showJson || typeof showJson !== 'object') return undefined
    const payload = showJson as Record<string, any>

    if (typeof payload.parameters === 'string') {
        const match = payload.parameters.match(/\bnum_ctx\s+(\d+)/i)
        if (match?.[1]) {
            const parsed = Number(match[1])
            if (Number.isFinite(parsed) && parsed >= 1024) return Math.floor(parsed)
        }
    }

    const info = payload.model_info
    if (info && typeof info === 'object') {
        for (const [key, val] of Object.entries(info as Record<string, unknown>)) {
            if (!key.endsWith('.context_length')) continue
            const parsed = typeof val === 'string' ? Number(val) : val
            if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 1024) {
                return Math.floor(parsed)
            }
        }
    }

    return undefined
}

/**
 * Creates a local Ollama provider backed by Ollama's OpenAI-compatible `/v1` endpoint.
 */
export function ollamaProvider(baseURL?: string, apiKey?: string): LLMProvider {
    const effectiveBaseURL = normalizeOllamaBaseUrl(baseURL)
    const provider = openaiProvider(effectiveBaseURL, apiKey || 'ollama')
    return {
        ...provider,
        id: 'ollama',
    }
}
