/**
 * model parity (issue #619): asks every provider which models it serves, the same way the cli
 * does, and compares the answer with packages/providers/src/model-catalog.json.
 *
 *   bun scripts/model-parity.ts                       # report, keys from .env.parity
 *   bun scripts/model-parity.ts --provider groq,xai   # some providers
 *   bun scripts/model-parity.ts --json parity.json    # also write the full lists
 *   bun scripts/model-parity.ts --apply               # update the catalog from what was served
 *   bun scripts/model-parity.ts --keys env            # read keys from the environment (ci)
 *   bun scripts/model-parity.ts --validate            # offline catalog checks only (ci)
 *
 * keys come from `.env.parity` (gitignored) by default, never from `.env`, so the server's own keys
 * are not mixed in. a key is only ever sent to its own provider. providers without a key are still
 * read when their model list is public. subscriptions use the logged-in session in
 * ~/.december/config.json unless --no-subscriptions is passed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
    classifyModelsFailure,
    DYNAMIC_ENDPOINTS,
    extractProviderMessage,
    MODEL_CATALOG,
    parseModelsResponse,
    resolveModelsRequest,
} from '@december/providers'

import type { ModelOption } from '@december/providers'

const args = process.argv.slice(2)
const argValue = (name: string): string | undefined => {
    const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`))
    if (i === -1) return undefined
    return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1]
}

const CATALOG_FILE = path.resolve(process.cwd(), 'packages/providers/src/model-catalog.json')
const envFile = path.resolve(process.cwd(), argValue('--env') || '.env.parity')
const keysFrom = argValue('--keys') === 'env' ? 'env' : 'file'
const jsonOut = argValue('--json')
const apply = args.includes('--apply')
const only = argValue('--provider')
    ?.split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
const skipSubscriptions = args.includes('--no-subscriptions')

/** env var per byok provider; DYNAMIC_ENDPOINTS has the rest */
const ENV_VARS: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GEMINI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    kimi: 'KIMI_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
    huggingface: 'HF_TOKEN',
}

const SUBSCRIPTIONS = new Set(['claude', 'codex', 'copilot', 'gemini', 'antigravity', 'amazon-q'])

/** catalog rules for --apply */
const APPLY_RULES = {
    /** lists this long are left to D1; the catalog keeps only its curated picks */
    maxListToAdd: 40,
    /** dated snapshots and version pins clutter /model; their alias is enough */
    snapshot: /-(\d{6,8}|\d{4})$|-\d{4}-\d{2}-\d{2}$|-latest$|-preview-\d|-v\d+(\.\d+)?$/,
    /** ids the list returns that are not chat models, where the list has no type field */
    notChat: {
        upstage: /^solar-(jev|decide)|^syn-|-contributor$/,
    } as Record<string, RegExp>,
}

/** `solar-pro-4` and `solar-pro4` are one model: compare ids without punctuation */
const looseId = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, '')

type Source = 'key' | 'subscription' | 'public'

interface ParityRow {
    provider: string
    source?: Source
    status: string
    httpStatus?: number
    message?: string
    defaultModel?: string
    defaultReturned?: boolean
    returned: string[]
    live: ModelOption[]
    catalogNotReturned: string[]
    returnedNotInCatalog: string[]
}

function readEnvFile(file: string): Record<string, string> {
    const env: Record<string, string> = {}
    if (!existsSync(file)) return env
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && m[2]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
    return env
}

function catalogFor(catalog: any, provider: string) {
    const canonical = catalog.aliases[provider] || provider
    return catalog.providers[canonical]
}

async function probe(
    provider: string,
    key: string,
    source: Source,
    baseUrl?: string
): Promise<ParityRow> {
    const entry = catalogFor(MODEL_CATALOG, provider)
    const catalogIds: string[] = (entry?.models || []).map((m: any) => m.id)
    const row: ParityRow = {
        provider,
        source,
        status: 'ok',
        defaultModel: entry?.defaultModel,
        returned: [],
        live: [],
        catalogNotReturned: [],
        returnedNotInCatalog: [],
    }
    const request = resolveModelsRequest(provider, key, baseUrl)
    if (!request) {
        row.status = 'no endpoint (catalog stays the list)'
        return row
    }
    try {
        // without a key there is nothing to check; the public list is still worth reading
        if (request.keyCheck && key) {
            const check = await fetch(request.keyCheck.url, {
                method: request.keyCheck.method || 'GET',
                headers: request.keyCheck.headers,
                body: request.keyCheck.body,
                signal: AbortSignal.timeout(15000),
            })
            if (!check.ok) {
                const body = await check.text()
                const reason = classifyModelsFailure(check.status, body)
                if (reason === 'bad_key' || reason === 'forbidden') {
                    row.status = reason
                    row.httpStatus = check.status
                    row.message = extractProviderMessage(body)
                    return row
                }
            }
        }
        const res = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) {
            const body = await res.text()
            row.status = key ? classifyModelsFailure(res.status, body) : 'no key'
            row.httpStatus = res.status
            row.message = key ? extractProviderMessage(body) : undefined
            return row
        }
        row.live = parseModelsResponse(request.parser, await res.json())
        row.returned = row.live.map((m) => m.value)
        if (row.returned.length === 0) {
            row.status = key ? 'empty list' : 'no key'
            return row
        }
        const liveSet = new Set(row.returned.map((id) => id.toLowerCase()))
        const catalogSet = new Set(catalogIds.map((id) => id.toLowerCase()))
        row.defaultReturned = entry?.defaultModel
            ? liveSet.has(entry.defaultModel.toLowerCase())
            : undefined
        row.catalogNotReturned = catalogIds.filter((id) => !liveSet.has(id.toLowerCase()))
        row.returnedNotInCatalog = row.returned.filter((id) => !catalogSet.has(id.toLowerCase()))
    } catch (err: any) {
        row.status = 'network'
        row.message = err?.message
    }
    return row
}

async function loadSubscriptions(): Promise<
    { provider: string; token: string; endpoint?: string }[]
> {
    if (skipSubscriptions) return []
    try {
        const { loadConfig } = await import('../apps/cli/src/config')
        const { resolveSubscriptionToken } =
            await import('../apps/cli/src/auth/subscriptions/subscription-manager')
        const cfg = await loadConfig()
        const out: { provider: string; token: string; endpoint?: string }[] = []
        for (const [provider, bundle] of Object.entries(cfg.subscriptions || {})) {
            if (!bundle) continue
            const fresh = await resolveSubscriptionToken(provider, bundle as any).catch(
                () => bundle as any
            )
            if (fresh?.accessToken) {
                out.push({ provider, token: fresh.accessToken, endpoint: fresh.endpoint })
            }
        }
        return out
    } catch (err: any) {
        console.warn(`could not read subscriptions: ${err?.message || err}`)
        return []
    }
}

const label = (id: string) =>
    id
        .split('/')
        .pop()!
        .split('-')
        .map((p) =>
            p.length <= 3 && /\d/.test(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)
        )
        .join(' ')

/**
 * --apply: the provider decides which ids exist (D1), the catalog keeps its order and labels.
 * subscriptions only gain models and context windows: their lists depend on the plan tier.
 */
function applyToCatalog(rows: ParityRow[]): string[] {
    const catalog = JSON.parse(readFileSync(CATALOG_FILE, 'utf8'))
    const report: string[] = []
    for (const row of rows) {
        if (row.status !== 'ok' || row.returned.length === 0) continue
        const entry = catalogFor(catalog, row.provider)
        if (!entry) continue
        const liveById = new Map(row.live.map((m) => [m.value.toLowerCase(), m]))
        const removed: string[] = []
        if (row.source !== 'subscription') {
            entry.models = entry.models.filter((m: any) => {
                const keep = liveById.has(m.id.toLowerCase())
                if (!keep) removed.push(m.id)
                return keep
            })
        }
        let contextUpdates = 0
        for (const m of entry.models) {
            const live = liveById.get(m.id.toLowerCase())
            if (live?.contextWindow && live.contextWindow !== m.contextWindow) {
                m.contextWindow = live.contextWindow
                contextUpdates++
            }
        }
        const added: string[] = []
        if (row.returned.length <= APPLY_RULES.maxListToAdd) {
            const have = new Set(entry.models.map((m: any) => looseId(m.id)))
            const notChat = APPLY_RULES.notChat[row.provider]
            for (const live of row.live) {
                if (
                    have.has(looseId(live.value)) ||
                    APPLY_RULES.snapshot.test(live.value) ||
                    notChat?.test(live.value)
                ) {
                    continue
                }
                have.add(looseId(live.value))
                const model: any = {
                    id: live.value,
                    label: live.label && live.label !== live.value ? live.label : label(live.value),
                }
                if (live.contextWindow) model.contextWindow = live.contextWindow
                entry.models.push(model)
                added.push(live.value)
            }
        }
        let defaultNote = ''
        const ids = entry.models.map((m: any) => m.id)
        if (!ids.includes(entry.defaultModel) && ids.length > 0) {
            defaultNote = ` default ${entry.defaultModel} -> ${ids[0]}`
            entry.defaultModel = ids[0]
        }
        if (removed.length || added.length || contextUpdates || defaultNote) {
            report.push(
                `${row.provider}: -${removed.length} +${added.length} context ${contextUpdates}${defaultNote}`
            )
        }
    }
    writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 4) + '\n')
    return report
}

/** --validate: offline checks that keep the catalog usable, for ci */
function validateCatalog(): string[] {
    const problems: string[] = []
    for (const [id, entry] of Object.entries(MODEL_CATALOG.providers) as [string, any][]) {
        const ids: string[] = (entry.models || []).map((m: any) => m.id)
        if (ids.length === 0) problems.push(`${id}: has no models`)
        if (entry.defaultModel && !ids.includes(entry.defaultModel)) {
            problems.push(`${id}: default ${entry.defaultModel} is not in its model list`)
        }
        const seen = new Set<string>()
        for (const m of entry.models || []) {
            if (seen.has(m.id)) problems.push(`${id}: ${m.id} is listed twice`)
            seen.add(m.id)
            if (!m.label || !String(m.label).trim()) problems.push(`${id}: ${m.id} has no label`)
            if (m.contextWindow !== undefined && !(m.contextWindow >= 1024)) {
                problems.push(`${id}: ${m.id} has context window ${m.contextWindow}`)
            }
        }
    }
    for (const [alias, target] of Object.entries(MODEL_CATALOG.aliases)) {
        if (!MODEL_CATALOG.providers[target])
            problems.push(`alias ${alias} -> ${target} is missing`)
    }
    return problems
}

const short = (ids: string[], n = 6) =>
    ids.length === 0
        ? '-'
        : `${ids.slice(0, n).join(', ')}${ids.length > n ? ` (+${ids.length - n})` : ''}`

async function main() {
    if (args.includes('--validate')) {
        const problems = validateCatalog()
        if (problems.length > 0) {
            console.error(
                `model catalog has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`
            )
            process.exit(1)
        }
        console.log(`model catalog ok: ${Object.keys(MODEL_CATALOG.providers).length} providers`)
        return
    }

    const env = keysFrom === 'env' ? (process.env as Record<string, string>) : readEnvFile(envFile)
    if (keysFrom === 'file' && !existsSync(envFile)) {
        console.warn(`no env file at ${envFile}; only public lists and subscriptions will run`)
    }

    const byok = new Set<string>([
        ...Object.keys(MODEL_CATALOG.providers),
        ...Object.keys(ENV_VARS),
    ])
    for (const p of ['december', ...SUBSCRIPTIONS]) byok.delete(p)

    const jobs: Promise<ParityRow>[] = []
    for (const provider of [...byok].sort()) {
        if (only && !only.includes(provider)) continue
        const envVar = ENV_VARS[provider] || DYNAMIC_ENDPOINTS[provider]?.envVar
        const key = envVar ? env[envVar] : undefined
        jobs.push(probe(provider, key || '', key ? 'key' : 'public'))
    }
    for (const sub of await loadSubscriptions()) {
        if (only && !only.includes(sub.provider)) continue
        jobs.push(probe(sub.provider, sub.token, 'subscription', sub.endpoint))
    }

    const rows = await Promise.all(jobs)
    rows.sort((a, b) => a.provider.localeCompare(b.provider))

    console.log(
        '| provider | status | default model returned? | in catalog, not returned (old or wrong ids) | returned, not in catalog (missing) |'
    )
    console.log('|---|---|---|---|---|')
    const skipped: string[] = []
    for (const r of rows) {
        if (r.status === 'no key') {
            skipped.push(r.provider)
            continue
        }
        const tag =
            r.source === 'subscription' ? ' (sub)' : r.source === 'public' ? ' (public)' : ''
        const status =
            r.status === 'ok'
                ? `ok (${r.returned.length})`
                : `${r.status}${r.httpStatus ? ` ${r.httpStatus}` : ''}${r.message ? `: ${r.message.slice(0, 80).replace(/\|/g, '/')}` : ''}`
        const def =
            r.defaultReturned === undefined
                ? '-'
                : r.defaultReturned
                  ? `yes (${r.defaultModel})`
                  : `**no** (${r.defaultModel})`
        console.log(
            `| ${r.provider}${tag} | ${status} | ${def} | ${short(r.catalogNotReturned)} | ${short(r.returnedNotInCatalog)} |`
        )
    }
    if (skipped.length > 0) {
        console.log(`\nno key and no public list (skipped): ${skipped.join(', ')}`)
    }

    if (jsonOut) {
        writeFileSync(path.resolve(process.cwd(), jsonOut), JSON.stringify(rows, null, 2))
        console.log(`\nfull lists written to ${jsonOut}`)
    }

    if (apply) {
        const report = applyToCatalog(rows)
        console.log(
            report.length > 0
                ? `\ncatalog updated:\n${report.join('\n')}`
                : '\ncatalog already matches'
        )
    }
}

await main()
