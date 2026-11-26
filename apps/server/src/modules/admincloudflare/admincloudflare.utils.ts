import type {
    CloudflareConfig,
    CountGroup,
    RumGroups,
    VitalsGroups,
    ZoneGroups,
} from './admincloudflare.types'

// Cloudflare, read only: the admin panel reads deploys (Pages), visitors and page speed (Web
// Analytics) and edge traffic (zone analytics). The token never leaves the server.

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'
const TIMEOUT_MS = 8000

// the two sites the panel reports on, by hostname (one Web Analytics site tag can cover
// more hosts, so the hostname is the clean filter)
export const LANDING_HOST = 'trydecember.com'
export const APP_HOST = 'app.trydecember.com'

// Web Analytics keeps 184 days but answers at most 93 days in one query
export const MAX_VISITOR_DAYS = 90

/** The Cloudflare settings, or null when the panel is not connected to Cloudflare. */
export const getCloudflareConfig = (): CloudflareConfig | null => {
    const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
    if (!token || !accountId) return null
    return {
        token,
        accountId,
        zoneId: process.env.CLOUDFLARE_ZONE_ID?.trim() || null,
        projects: (process.env.CLOUDFLARE_PAGES_PROJECTS ?? '')
            .split(',')
            .map((name) => name.trim())
            .filter((name) => /^[a-z0-9-]{1,63}$/.test(name)),
    }
}

/** Tests never call outside services. */
export const isCloudflareOff = () => process.env.NODE_ENV === 'test'

const errorText = (errors: Array<{ message?: string }> | undefined, status: number) =>
    errors
        ?.map((e) => e.message)
        .filter(Boolean)
        .join('; ') || `Cloudflare answered ${status}`

/** A GET to the REST API. Throws with Cloudflare's own error text, never with the token. */
export const cloudflareGet = async <T>(token: string, path: string): Promise<T> => {
    const res = await fetch(`${CLOUDFLARE_API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const json = (await res.json().catch(() => null)) as {
        success?: boolean
        result?: T
        errors?: Array<{ message?: string }>
    } | null
    if (!res.ok || !json?.success) throw new Error(errorText(json?.errors, res.status))
    return json.result as T
}

/** A GraphQL Analytics query. Throws with Cloudflare's own error text. */
export const cloudflareGraphql = async <T>(
    token: string,
    query: string,
    variables: Record<string, unknown>
): Promise<T> => {
    const res = await fetch(`${CLOUDFLARE_API}/graphql`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const json = (await res.json().catch(() => null)) as {
        data?: T
        errors?: Array<{ message?: string }> | null
    } | null
    if (!res.ok || !json?.data || (json.errors && json.errors.length > 0)) {
        throw new Error(errorText(json?.errors ?? undefined, res.status))
    }
    return json.data
}

export const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
export const isoDaysAgo = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')

/** Web vitals come in microseconds; -1 means no data */
export const microsToMs = (value: number | null | undefined) =>
    typeof value === 'number' && value >= 0 ? Math.round(value / 1000) : null

export const shortError = (err: unknown) =>
    (err instanceof Error ? err.message : 'could not read Cloudflare').slice(0, 200)

// ----- shaping Cloudflare's answers (pure, so tests can feed them Cloudflare-shaped data) -----

const visitsOf = (group: CountGroup<unknown>) => group.sum?.visits ?? 0

/** C1, C2: visits and page views per site, the top landing pages and where visits come from */
export const shapeVisitors = (data: {
    groups: RumGroups['viewer']['accounts'][number]
    signups: number
    days: number
    shownDays: number
}) => {
    const { groups, signups, days, shownDays } = data
    const site = (host: string) => {
        const row = groups.sites.find((r) => r.dimensions.requestHost === host)
        return { host, visits: row ? visitsOf(row) : 0, pageViews: row?.count ?? 0 }
    }
    return {
        connected: true as const,
        error: null,
        requestedDays: days,
        days: shownDays,
        landing: site(LANDING_HOST),
        app: site(APP_HOST),
        // C2: accounts made in the same days, against landing page visits
        signups,
        topPages: groups.pages
            .map((row) => ({ path: row.dimensions.requestPath || '/', views: row.count }))
            .filter((row) => row.views > 0),
        // our own landing page is not a referrer; an empty host is a direct visit
        referrers: groups.referrers
            .filter(
                (row) => ![LANDING_HOST, `www.${LANDING_HOST}`].includes(row.dimensions.refererHost)
            )
            .map((row) => ({ host: row.dimensions.refererHost || 'Direct', visits: visitsOf(row) }))
            .filter((row) => row.visits > 0)
            .slice(0, 5),
    }
}

// what Cloudflare could have served from its cache; "dynamic" and "none" never can
const CACHEABLE = ['hit', 'miss', 'expired', 'revalidated', 'updating', 'stale']

/** C4: requests, server errors, blocked requests and the cache share, the last 24 hours */
export const shapeEdge = (zone: ZoneGroups['viewer']['zones'][number]) => {
    const count = (match: (status: number) => boolean) =>
        zone.statuses
            .filter((row) => match(row.dimensions.edgeResponseStatus))
            .reduce((total, row) => total + row.count, 0)
    const cacheable = zone.cache.filter((row) => CACHEABLE.includes(row.dimensions.cacheStatus))
    const hits = cacheable
        .filter((row) => row.dimensions.cacheStatus === 'hit')
        .reduce((total, row) => total + row.count, 0)
    const cacheableTotal = cacheable.reduce((total, row) => total + row.count, 0)
    return {
        connected: true as const,
        error: null,
        requests: count(() => true),
        serverErrors: count((status) => status >= 500),
        blocked: count((status) => status === 403),
        cacheHitPct: cacheableTotal > 0 ? Math.round((hits / cacheableTotal) * 100) : null,
    }
}

const share = (good: number, total: number) => (total > 0 ? Math.round((good / total) * 100) : null)

/** C5: p75 page speed per site; Cloudflare sends LCP and INP in microseconds, -1 for none */
export const shapePageSpeed = (data: {
    rows: VitalsGroups['viewer']['accounts'][number]['vitals']
    days: number
}) => {
    const { rows, days } = data
    const site = (host: string, label: string) => {
        const row = rows.find((r) => r.dimensions.requestHost === host)
        if (!row) return { host, label, samples: 0, lcpMs: null, inpMs: null, cls: null }
        const cls = row.quantiles.cumulativeLayoutShiftP75
        return {
            host,
            label,
            samples: row.count,
            lcpMs: microsToMs(row.quantiles.largestContentfulPaintP75),
            inpMs: microsToMs(row.quantiles.interactionToNextPaintP75),
            cls: typeof cls === 'number' && cls >= 0 ? Math.round(cls * 1000) / 1000 : null,
            lcpGoodPct: share(row.sum.lcpGood, row.sum.lcpTotal),
            inpGoodPct: share(row.sum.inpGood, row.sum.inpTotal),
            clsGoodPct: share(row.sum.clsGood, row.sum.clsTotal),
        }
    }
    return {
        connected: true as const,
        error: null,
        days,
        sites: [site(LANDING_HOST, 'Landing page'), site(APP_HOST, 'Web app')],
    }
}
