import { execSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
    formatModelLabel,
    getOllamaApiOrigin,
    isChatModel,
    normalizeOllamaBaseUrl,
    OLLAMA_DEFAULT_BASE_URL,
    parseOllamaContextWindow,
    type ModelOption,
} from '@december/providers'

export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download'

export interface OllamaStarterModel {
    id: string
    label: string
    hint: string
}

export const OLLAMA_STARTER_MODELS: readonly OllamaStarterModel[] = [
    {
        id: 'qwen3:8b',
        label: 'qwen3:8b',
        hint: '~5.2 GB · balanced reasoning & tool calling',
    },
    {
        id: 'qwen2.5-coder:7b',
        label: 'qwen2.5-coder:7b',
        hint: '~4.7 GB · fast coding model',
    },
    {
        id: 'qwen2.5-coder:3b',
        label: 'qwen2.5-coder:3b',
        hint: '~1.9 GB · lightweight, low RAM',
    },
]

export type OllamaStatus = 'ready' | 'no_models' | 'installed_not_running' | 'not_installed'

export interface OllamaInstallSpec {
    command: string
    label: string
}

export interface OllamaProbeResult {
    status: OllamaStatus
    baseUrl: string
    binaryPath?: string
    models: ModelOption[]
    installSpec?: OllamaInstallSpec
    platform: NodeJS.Platform
}

function defaultHasCommand(cmd: string, platform: NodeJS.Platform): string | undefined {
    try {
        const lookup = platform === 'win32' ? `where ${cmd}` : `which ${cmd}`
        const out = execSync(lookup, {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 1500,
        })
            .split(/\r?\n/)[0]
            ?.trim()
        return out || undefined
    } catch {
        // Intentionally swallowed: binary is not on PATH
        return undefined
    }
}

export function detectOllamaBinary(
    platform: NodeJS.Platform = os.platform(),
    hasCommand: (cmd: string, p: NodeJS.Platform) => string | undefined = defaultHasCommand,
    fileExists: (p: string) => boolean = existsSync
): string | undefined {
    const onPath = hasCommand('ollama', platform)
    if (onPath) return onPath

    const candidates: string[] = []
    if (platform === 'darwin') {
        candidates.push(
            '/opt/homebrew/bin/ollama',
            '/usr/local/bin/ollama',
            '/Applications/Ollama.app/Contents/Resources/ollama'
        )
    } else if (platform === 'linux') {
        candidates.push('/usr/local/bin/ollama', '/usr/bin/ollama', '/snap/bin/ollama')
    } else if (platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA
        if (localAppData) {
            candidates.push(path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'))
        }
    }

    return candidates.find((p) => fileExists(p))
}

export function getOllamaInstallSpec(
    platform: NodeJS.Platform = os.platform(),
    hasCommand: (cmd: string, p: NodeJS.Platform) => string | undefined = defaultHasCommand
): OllamaInstallSpec | undefined {
    if (platform === 'darwin') {
        if (hasCommand('brew', platform)) {
            return { command: 'brew install ollama', label: 'brew install ollama' }
        }
        return undefined
    }
    if (platform === 'linux') {
        if (hasCommand('curl', platform)) {
            return {
                command: 'curl -fsSL https://ollama.com/install.sh | sh',
                label: 'curl -fsSL https://ollama.com/install.sh | sh',
            }
        }
        return undefined
    }
    if (platform === 'win32') {
        if (hasCommand('winget', platform)) {
            return {
                command: 'winget install --id Ollama.Ollama -e',
                label: 'winget install --id Ollama.Ollama -e',
            }
        }
        return undefined
    }
    return undefined
}

async function fetchOllamaModelContextWindow(
    origin: string,
    modelName: string,
    fetchFn: typeof fetch
): Promise<number | undefined> {
    try {
        const res = await fetchFn(`${origin}/api/show`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName }),
            signal: AbortSignal.timeout(700),
        })
        if (!res.ok) return undefined
        const json = await res.json()
        return parseOllamaContextWindow(json)
    } catch {
        // Intentionally swallowed: /api/show enrichment is best-effort
        return undefined
    }
}

export async function fetchOllamaTags(
    baseUrl?: string,
    fetchFn: typeof fetch = fetch,
    timeoutMs = 800
): Promise<{ reachable: boolean; models: ModelOption[] }> {
    const origin = getOllamaApiOrigin(baseUrl)
    try {
        const res = await fetchFn(`${origin}/api/tags`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(timeoutMs),
        })
        if (!res.ok) {
            return { reachable: false, models: [] }
        }
        const json: any = await res.json()
        const rawModels: any[] = Array.isArray(json?.models) ? json.models : []
        const chatIds = rawModels
            .map((m) => (typeof m?.name === 'string' ? m.name : m?.model))
            .filter(
                (id): id is string => typeof id === 'string' && id.length > 0 && isChatModel(id)
            )

        const enriched = await Promise.all(
            chatIds.slice(0, 12).map(async (id) => {
                const contextWindow = await fetchOllamaModelContextWindow(origin, id, fetchFn)
                return {
                    label: formatModelLabel(id) === id ? id : `${id}`,
                    value: id,
                    ...(contextWindow ? { contextWindow } : {}),
                } satisfies ModelOption
            })
        )
        for (const id of chatIds.slice(12)) {
            enriched.push({ label: id, value: id })
        }

        return { reachable: true, models: enriched }
    } catch {
        // Intentionally swallowed: localhost probe failed or timed out
        return { reachable: false, models: [] }
    }
}

export async function probeOllama(
    baseUrl?: string,
    options?: {
        fetchFn?: typeof fetch
        platform?: NodeJS.Platform
        binaryPath?: string | null
        installSpec?: OllamaInstallSpec | null
        timeoutMs?: number
    }
): Promise<OllamaProbeResult> {
    const fetchFn = options?.fetchFn ?? fetch
    const platform = options?.platform ?? os.platform()
    const normalizedBase = normalizeOllamaBaseUrl(baseUrl || OLLAMA_DEFAULT_BASE_URL)
    const binaryPath =
        options?.binaryPath === null
            ? undefined
            : (options?.binaryPath ?? detectOllamaBinary(platform))
    const installSpec =
        options?.installSpec === null
            ? undefined
            : (options?.installSpec ?? getOllamaInstallSpec(platform))

    const tags = await fetchOllamaTags(normalizedBase, fetchFn, options?.timeoutMs ?? 800)
    if (tags.reachable) {
        return {
            status: tags.models.length > 0 ? 'ready' : 'no_models',
            baseUrl: normalizedBase,
            binaryPath,
            models: tags.models,
            installSpec,
            platform,
        }
    }

    return {
        status: binaryPath ? 'installed_not_running' : 'not_installed',
        baseUrl: normalizedBase,
        binaryPath,
        models: [],
        installSpec,
        platform,
    }
}

export async function startOllamaServer(
    baseUrl?: string,
    options?: {
        binaryPath?: string
        platform?: NodeJS.Platform
        fetchFn?: typeof fetch
        maxWaitMs?: number
    }
): Promise<OllamaProbeResult> {
    const platform = options?.platform ?? os.platform()
    const binary = options?.binaryPath || detectOllamaBinary(platform) || 'ollama'

    try {
        if (
            platform === 'darwin' &&
            existsSync('/Applications/Ollama.app') &&
            !options?.binaryPath
        ) {
            const appProc = spawn('open', ['-g', '-a', 'Ollama'], {
                detached: true,
                stdio: 'ignore',
            })
            appProc.unref()
        } else {
            const child = spawn(binary, ['serve'], {
                detached: true,
                stdio: 'ignore',
            })
            child.unref()
        }
    } catch {
        // Intentionally swallowed: probe loop below reports final status
    }

    const deadline = Date.now() + (options?.maxWaitMs ?? 3000)
    while (Date.now() < deadline) {
        const result = await probeOllama(baseUrl, {
            fetchFn: options?.fetchFn,
            platform,
            binaryPath: binary,
        })
        if (result.status === 'ready' || result.status === 'no_models') {
            return result
        }
        await new Promise((r) => setTimeout(r, 300))
    }

    return probeOllama(baseUrl, {
        fetchFn: options?.fetchFn,
        platform,
        binaryPath: binary,
    })
}
