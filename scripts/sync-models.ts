import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { $ } from 'bun'
import dotenv from 'dotenv'

dotenv.config()

interface CatalogModel {
    id: string
    label: string
    contextWindow: number
    thinking?: boolean
}

interface CatalogProvider {
    id: string
    name: string
    defaultModel: string
    endpoint?: string
    envKey?: string
    openRouterPrefix?: string
    models: CatalogModel[]
}

interface ModelCatalog {
    version: number
    aliases: Record<string, string>
    providers: Record<string, CatalogProvider>
}

interface LiveModelMeta {
    id: string
    label?: string
    contextWindow?: number
    thinking?: boolean
}

const args = process.argv.slice(2)
const isSync = args.includes('--sync')
const isVerbose = args.includes('--verbose')
const isStrict = args.includes('--strict')
const isPrune = args.includes('--prune')

const providerArgIdx = args.findIndex((a) => a === '--provider' || a.startsWith('--provider='))
let targetProviders: string[] | null = null
if (providerArgIdx !== -1) {
    const raw = args[providerArgIdx].includes('=')
        ? args[providerArgIdx].split('=')[1]
        : args[providerArgIdx + 1]
    if (raw) {
        targetProviders = raw
            .split(',')
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean)
    }
}

const catalogPath = path.resolve(process.cwd(), 'packages/providers/src/model-catalog.json')
if (!existsSync(catalogPath)) {
    console.error(`Error: Catalog file not found at ${catalogPath}`)
    process.exit(1)
}

const rawCatalog = readFileSync(catalogPath, 'utf-8')
const catalog: ModelCatalog = JSON.parse(rawCatalog)

// 1. Fetch OpenRouter Live Catalog as universal fallback
interface OpenRouterModel {
    id: string
    name: string
    context_length: number
}

let openRouterModels: OpenRouterModel[] = []
async function fetchOpenRouterCatalog(): Promise<OpenRouterModel[]> {
    if (openRouterModels.length > 0) return openRouterModels
    try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
            const json = (await res.json()) as { data?: OpenRouterModel[] }
            openRouterModels = json.data || []
        }
    } catch (err: any) {
        if (isVerbose) {
            console.warn(`[WARN] Could not reach OpenRouter catalog: ${err.message}`)
        }
    }
    return openRouterModels
}

function isNonChatModel(id: string): boolean {
    const lower = id.toLowerCase()
    return (
        lower.includes('embedding') ||
        lower.includes('tts') ||
        lower.includes('transcribe') ||
        lower.includes('whisper') ||
        lower.includes('dall-e') ||
        lower.includes('midjourney') ||
        lower.includes('flux') ||
        lower.includes('stable-diffusion') ||
        lower.includes('sdxl') ||
        lower.includes('moderation') ||
        lower.includes('babbage') ||
        lower.includes('davinci') ||
        lower.includes('lyria') ||
        lower.includes('robotics') ||
        lower.includes('aqa')
    )
}

// 2. Fetch Native Provider Models with Rich Metadata
async function fetchNativeProviderModels(
    providerId: string,
    endpoint: string,
    envKey?: string
): Promise<LiveModelMeta[] | null> {
    const apiKey = envKey ? process.env[envKey] : undefined
    if (envKey && !apiKey) return null

    try {
        const headers: Record<string, string> = { Accept: 'application/json' }
        let url = endpoint

        if (providerId === 'anthropic') {
            headers['x-api-key'] = apiKey!
            headers['anthropic-version'] = '2023-06-01'
        } else if (providerId === 'google') {
            url = `${endpoint}?key=${apiKey}`
        } else if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`
        }

        const res = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(8000),
        })

        if (!res.ok) {
            if (isVerbose) {
                console.warn(`[DEBUG] ${providerId} returned HTTP ${res.status}`)
            }
            return null
        }

        const data = await res.json()

        if (providerId === 'google') {
            const rawList = Array.isArray(data.models) ? data.models : []
            return rawList
                .filter((m: any) => {
                    const id = (m.name || '').replace(/^models\//, '')
                    const methods = m.supportedGenerationMethods || []
                    if (!methods.includes('generateContent')) return false
                    if (isNonChatModel(id)) return false
                    return true
                })
                .map((m: any) => {
                    const id = (m.name || '').replace(/^models\//, '')
                    return {
                        id,
                        label: m.displayName || formatModelLabel(id),
                        contextWindow: m.inputTokenLimit || 1048576,
                        thinking: !!m.thinking,
                    }
                })
        }

        if (providerId === 'anthropic') {
            const rawList = Array.isArray(data.data) ? data.data : []
            return rawList
                .filter(
                    (m: any) => m.id && (m.type === 'model' || !m.type) && !isNonChatModel(m.id)
                )
                .map((m: any) => ({
                    id: m.id,
                    label: m.display_name || formatModelLabel(m.id),
                    contextWindow: m.max_input_tokens || 200000,
                    thinking: !!m.capabilities?.thinking?.supported,
                }))
        }

        const rawList = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
        return rawList
            .map((m: any) => {
                const id = m.id || m.name
                if (!id || typeof id !== 'string') return null
                if (isNonChatModel(id)) return null
                return {
                    id,
                    label: m.name || m.display_name || formatModelLabel(id),
                    contextWindow: m.context_length || m.max_input_tokens || 128000,
                    thinking: !!(m.thinking || m.capabilities?.thinking?.supported),
                }
            })
            .filter(Boolean) as LiveModelMeta[]
    } catch (err: any) {
        if (isVerbose) {
            console.warn(`[DEBUG] Failed to reach native ${providerId}: ${err.message}`)
        }
        return null
    }
}

// 3. Format Human-Friendly Model Label
function formatModelLabel(id: string): string {
    const clean = id.includes('/') ? id.split('/').pop()! : id
    return clean
        .split(/[-_.]/)
        .map((part) =>
            part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)
        )
        .join(' ')
}

// 4. Main Verification Loop
async function main() {
    console.log(
        `\n======================================================` +
            `\n  December Model & Provider Live Endpoint Tester` +
            `\n  Mode: ${isSync ? 'SYNC (Updates Catalog)' : 'CHECK (Read-Only)'}` +
            `\n======================================================\n`
    )

    console.log('Fetching OpenRouter live reference catalog...')
    const openRouterCatalog = await fetchOpenRouterCatalog()
    console.log(`Loaded ${openRouterCatalog.length} models from OpenRouter catalog.\n`)

    const providersToCheck = Object.keys(catalog.providers).filter((p) => {
        if (!targetProviders) return true
        return targetProviders.includes(p.toLowerCase())
    })

    interface ProviderReport {
        id: string
        name: string
        channel: string
        totalCatalog: number
        activeCount: number
        deprecatedCount: number
        newCount: number
        deprecatedModels: string[]
        newModels: string[]
    }

    const reports: ProviderReport[] = []
    let totalDeprecated = 0
    let totalNew = 0
    let totalCatalog = 0

    const norm = (id: string) => id.toLowerCase().replace(/[\._]/g, '-')

    for (const providerId of providersToCheck) {
        const provider = catalog.providers[providerId]
        if (!provider) continue

        totalCatalog += provider.models.length

        let liveModels: LiveModelMeta[] = []
        let channel = 'Offline (Retained)'

        if (provider.endpoint) {
            const nativeResult = await fetchNativeProviderModels(
                providerId,
                provider.endpoint,
                provider.envKey
            )
            if (nativeResult && nativeResult.length > 0) {
                channel = `Native API (${provider.envKey || 'direct'})`
                liveModels = nativeResult
            }
        }

        if (liveModels.length === 0 && openRouterCatalog.length > 0) {
            const orPrefix = provider.openRouterPrefix || providerId
            const matched = openRouterCatalog.filter(
                (m) =>
                    !isNonChatModel(m.id) &&
                    (m.id.startsWith(`${orPrefix}/`) ||
                        provider.models.some((cm) => cm.id === m.id || m.id.endsWith(`/${cm.id}`)))
            )

            if (matched.length > 0) {
                channel = 'OpenRouter Fallback'
                liveModels = matched.map((m) => {
                    const bareId = m.id.includes('/') ? m.id.split('/').pop()! : m.id
                    const cleanLabel = (m.name || '').replace(/^[^:]+:\s*/, '')
                    return {
                        id: bareId,
                        label: cleanLabel || formatModelLabel(bareId),
                        contextWindow: m.context_length || 128000,
                        thinking:
                            m.id.includes('thinking') ||
                            m.id.includes('r1') ||
                            m.id.includes('reason'),
                    }
                })
            }
        }

        const liveMap = new Map<string, LiveModelMeta>()
        for (const m of liveModels) {
            liveMap.set(m.id, m)
            const bareId = m.id.includes('/') ? m.id.split('/').pop()! : m.id
            if (!liveMap.has(bareId)) {
                liveMap.set(bareId, m)
            }
        }

        function findLiveMeta(modelId: string): LiveModelMeta | undefined {
            if (liveMap.has(modelId)) return liveMap.get(modelId)
            const bare = modelId.includes('/') ? modelId.split('/').pop()! : modelId
            if (liveMap.has(bare)) return liveMap.get(bare)
            const nTarget = norm(modelId)
            const nBare = norm(bare)
            for (const [key, meta] of liveMap.entries()) {
                const nKey = norm(key)
                if (
                    nKey === nTarget ||
                    nKey === nBare ||
                    nKey.startsWith(nTarget) ||
                    nBare.startsWith(nKey) ||
                    nTarget.startsWith(nKey)
                ) {
                    return meta
                }
            }
            return undefined
        }

        const activeModels: CatalogModel[] = []
        const deprecatedModels: string[] = []

        for (const model of provider.models) {
            const liveMeta = liveModels.length > 0 ? findLiveMeta(model.id) : undefined
            const isActive = liveModels.length === 0 || !!liveMeta

            if (isActive) {
                if (isSync && liveMeta) {
                    if (liveMeta.contextWindow && liveMeta.contextWindow > 0) {
                        model.contextWindow = liveMeta.contextWindow
                    }
                    if (liveMeta.label && liveMeta.label.trim()) {
                        model.label = liveMeta.label
                    }
                    if (typeof liveMeta.thinking === 'boolean') {
                        model.thinking = liveMeta.thinking
                    }
                }
                activeModels.push(model)
            } else {
                deprecatedModels.push(model.id)
                if (!isPrune) {
                    activeModels.push(model)
                }
            }
        }

        const newModels: LiveModelMeta[] = []
        if (liveModels.length > 0) {
            const isNative = channel.startsWith('Native')
            const allowNew = isNative || args.includes('--include-new')

            if (allowNew) {
                for (const live of liveModels) {
                    if (providerId === 'openrouter' && !args.includes('--include-all-openrouter')) {
                        continue
                    }

                    const isDatedSnapshot = /-\d{8}$/.test(live.id) || /-\d{3}$/.test(live.id)
                    if (isDatedSnapshot && !args.includes('--include-snapshots')) {
                        continue
                    }

                    const alreadyHas = provider.models.some((m) => {
                        const nModel = norm(m.id)
                        const nLive = norm(live.id)
                        return (
                            nModel === nLive ||
                            nModel.endsWith(`-${nLive}`) ||
                            nLive.endsWith(`-${nModel}`)
                        )
                    })

                    if (!alreadyHas) {
                        newModels.push(live)
                    }
                }
            }
        }

        totalDeprecated += deprecatedModels.length
        totalNew += newModels.length

        reports.push({
            id: providerId,
            name: provider.name,
            channel,
            totalCatalog: provider.models.length,
            activeCount: activeModels.length,
            deprecatedCount: deprecatedModels.length,
            newCount: newModels.length,
            deprecatedModels,
            newModels: newModels.map((m) => m.id),
        })

        if (isSync) {
            provider.models = activeModels
            for (const n of newModels) {
                provider.models.push({
                    id: n.id,
                    label: n.label || formatModelLabel(n.id),
                    contextWindow: n.contextWindow || 128000,
                    thinking: !!n.thinking,
                })
            }
        }
    }

    // 5. Output Summary Table
    const colPad = (str: string, len: number) =>
        str.length >= len ? str.slice(0, len) : str.padEnd(len)

    console.log(
        `${colPad('Provider', 18)} | ${colPad('Channel', 24)} | ${colPad('Models', 8)} | ${colPad('Active', 8)} | ${colPad('Deprecated', 12)} | ${colPad('New', 6)}`
    )
    console.log('-'.repeat(88))

    for (const r of reports) {
        const depStr = r.deprecatedCount > 0 ? `! ${r.deprecatedCount}` : '0'
        const newStr = r.newCount > 0 ? `+ ${r.newCount}` : '0'
        console.log(
            `${colPad(r.id, 18)} | ${colPad(r.channel, 24)} | ${colPad(String(r.totalCatalog), 8)} | ${colPad(String(r.activeCount), 8)} | ${colPad(depStr, 12)} | ${colPad(newStr, 6)}`
        )
    }

    console.log('-'.repeat(88))
    console.log(
        `Total Providers Checked: ${reports.length} | Total Models: ${totalCatalog} | Deprecated: ${totalDeprecated} | New: ${totalNew}\n`
    )

    if (totalDeprecated > 0 && isVerbose) {
        console.log('Deprecated Models Found:')
        for (const r of reports) {
            if (r.deprecatedModels.length > 0) {
                console.log(`  - [${r.id}] ${r.deprecatedModels.join(', ')}`)
            }
        }
        console.log('')
    }

    // 6. Write Changes if --sync
    if (isSync) {
        console.log(`Writing updated catalog to ${catalogPath}...`)
        writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
        console.log('Formatting codebase with Prettier...')
        await $`bun run format`

        console.log('Running test verification on updated catalog...')
        try {
            await $`bun test apps/cli/test/models.test.ts`
            console.log('\nAll tests passed successfully with updated model catalog!')
        } catch {
            console.error('\nTests failed after catalog sync. Please inspect the changes.')
            process.exit(1)
        }
    } else {
        console.log(
            'Done! To write changes and sync catalog with live endpoints, run: bun run models:sync\n'
        )
    }

    if (isStrict && totalDeprecated > 0) {
        console.error(`[STRICT ERROR] Found ${totalDeprecated} deprecated models.`)
        process.exit(1)
    }
}

main().catch((err) => {
    console.error('Fatal sync-models error:', err)
    process.exit(1)
})
