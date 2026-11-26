import { cached } from '../adminstats/adminstats.utils'

import { admincloudflareRepository } from './admincloudflare.repository'
import {
    APP_HOST,
    LANDING_HOST,
    MAX_VISITOR_DAYS,
    cloudflareGet,
    cloudflareGraphql,
    getCloudflareConfig,
    isCloudflareOff,
    isoDaysAgo,
    isoNow,
    shapeEdge,
    shapePageSpeed,
    shapeVisitors,
    shortError,
} from './admincloudflare.utils'

import type {
    FreshOption,
    PagesDeployment,
    RumGroups,
    VisitorsWindow,
    VitalsGroups,
    ZoneGroups,
} from './admincloudflare.types'

const NOT_CONNECTED = { connected: false as const }

/**
 * Runs a cached Cloudflare read. A failed read throws inside the cache, so it is never
 * cached and the next refresh tries again; the page gets Cloudflare's own error text.
 */
const readOrError = async <T>(label: string, read: () => Promise<T>) => {
    try {
        return await read()
    } catch (err) {
        console.warn(`[admincloudflare] could not read ${label}`, err)
        return { connected: true as const, error: shortError(err) }
    }
}

// ----- C3: deploys -----

/** The last deploys of each Pages project (the web app and the landing page). */
const loadDeploys = async () => {
    const config = getCloudflareConfig()
    if (!config || isCloudflareOff()) return { connected: false, projects: [] }
    const projects = await Promise.all(
        config.projects.map(async (name) => {
            try {
                const rows = await cloudflareGet<PagesDeployment[]>(
                    config.token,
                    `/accounts/${encodeURIComponent(config.accountId)}/pages/projects/${encodeURIComponent(name)}/deployments?per_page=6`
                )
                return {
                    name,
                    error: null,
                    deploys: rows.map((row) => ({
                        id: row.id,
                        shortId: row.short_id ?? row.id.slice(0, 8),
                        environment: row.environment ?? 'production',
                        status: row.latest_stage?.status ?? 'unknown',
                        stage: row.latest_stage?.name ?? null,
                        createdAt: row.created_on ?? null,
                        endedAt: row.latest_stage?.ended_on ?? null,
                        branch: row.deployment_trigger?.metadata?.branch ?? null,
                        commit: row.deployment_trigger?.metadata?.commit_hash?.slice(0, 7) ?? null,
                        // the first line only
                        message:
                            (row.deployment_trigger?.metadata?.commit_message ?? '')
                                .split('\n')[0]
                                ?.slice(0, 140) || null,
                        url: row.url ?? null,
                    })),
                }
            } catch (err) {
                console.warn(`[admincloudflare] could not read deploys of ${name}`, err)
                return { name, error: shortError(err), deploys: [] }
            }
        })
    )
    return { connected: true, projects }
}

const getDeploys = async (data: FreshOption) => {
    const { fresh } = data
    return cached('cloudflare:deploys', 60, loadDeploys, { fresh })
}

// ----- C1, C2: visitors of the landing page and the web app -----

// people only (bot 0), on the two sites; the host names are constants, never user input
const SITES = `requestHost_in: ${JSON.stringify([LANDING_HOST, APP_HOST])}`
const VISITORS_QUERY = `
query ($account: String!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      sites: rumPageloadEventsAdaptiveGroups(
        limit: 5
        filter: { datetime_geq: $since, datetime_leq: $until, bot: 0, ${SITES} }
      ) { count sum { visits } dimensions { requestHost } }
      pages: rumPageloadEventsAdaptiveGroups(
        limit: 5
        filter: { datetime_geq: $since, datetime_leq: $until, bot: 0, requestHost: "${LANDING_HOST}" }
        orderBy: [count_DESC]
      ) { count dimensions { requestPath } }
      referrers: rumPageloadEventsAdaptiveGroups(
        limit: 8
        filter: { datetime_geq: $since, datetime_leq: $until, bot: 0, requestHost: "${LANDING_HOST}" }
        orderBy: [sum_visits_DESC]
      ) { count sum { visits } dimensions { refererHost } }
    }
  }
}`

const loadVisitors = async (days: number) => {
    const config = getCloudflareConfig()
    if (!config || isCloudflareOff()) return NOT_CONNECTED
    const shownDays = Math.min(days, MAX_VISITOR_DAYS)
    const since = isoDaysAgo(shownDays)
    const [data, signups] = await Promise.all([
        cloudflareGraphql<RumGroups>(config.token, VISITORS_QUERY, {
            account: config.accountId,
            since,
            until: isoNow(),
        }),
        admincloudflareRepository.countSignupsSince(new Date(since)),
    ])
    const groups = data.viewer.accounts[0]
    if (!groups) return { connected: true as const, error: 'account not found' }
    return shapeVisitors({ groups, signups, days, shownDays })
}

const getVisitors = async (data: VisitorsWindow) => {
    const { days, fresh } = data
    const shown = Math.min(days, MAX_VISITOR_DAYS)
    return readOrError('visitors', () =>
        cached(`cloudflare:visitors:${shown}:${days}`, 5 * 60, () => loadVisitors(days), { fresh })
    )
}

// ----- C4: traffic at the edge, the last 24 hours -----

const EDGE_QUERY = `
query ($zone: String!, $since: Time!, $until: Time!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      statuses: httpRequestsAdaptiveGroups(
        limit: 60
        filter: { datetime_geq: $since, datetime_leq: $until, requestSource: "eyeball" }
        orderBy: [count_DESC]
      ) { count dimensions { edgeResponseStatus } }
      cache: httpRequestsAdaptiveGroups(
        limit: 20
        filter: { datetime_geq: $since, datetime_leq: $until, requestSource: "eyeball" }
        orderBy: [count_DESC]
      ) { count dimensions { cacheStatus } }
    }
  }
}`

const loadEdge = async () => {
    const config = getCloudflareConfig()
    if (!config || !config.zoneId || isCloudflareOff()) return NOT_CONNECTED
    const data = await cloudflareGraphql<ZoneGroups>(config.token, EDGE_QUERY, {
        zone: config.zoneId,
        since: isoDaysAgo(1),
        until: isoNow(),
    })
    const zone = data.viewer.zones[0]
    if (!zone) return { connected: true as const, error: 'zone not found' }
    return shapeEdge(zone)
}

const getEdge = async (data: FreshOption) => {
    const { fresh } = data
    return readOrError('edge traffic', () => cached('cloudflare:edge', 2 * 60, loadEdge, { fresh }))
}

// ----- C5: page speed for real users -----

const VITALS_QUERY = `
query ($account: String!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      vitals: rumWebVitalsEventsAdaptiveGroups(
        limit: 5
        filter: { datetime_geq: $since, datetime_leq: $until, bot: 0, ${SITES} }
      ) {
        count
        dimensions { requestHost }
        quantiles { largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75 }
        sum { lcpGood lcpTotal inpGood inpTotal clsGood clsTotal }
      }
    }
  }
}`

const PAGE_SPEED_DAYS = 30

const share = (good: number, total: number) => (total > 0 ? Math.round((good / total) * 100) : null)

const loadPageSpeed = async () => {
    const config = getCloudflareConfig()
    if (!config || isCloudflareOff()) return NOT_CONNECTED
    const data = await cloudflareGraphql<VitalsGroups>(config.token, VITALS_QUERY, {
        account: config.accountId,
        since: isoDaysAgo(PAGE_SPEED_DAYS),
        until: isoNow(),
    })
    return shapePageSpeed({
        rows: data.viewer.accounts[0]?.vitals ?? [],
        days: PAGE_SPEED_DAYS,
    })
}

const getPageSpeed = async (data: FreshOption) => {
    const { fresh } = data
    return readOrError('page speed', () =>
        cached('cloudflare:page-speed', 10 * 60, loadPageSpeed, { fresh })
    )
}

export const admincloudflareService = {
    getDeploys,
    getVisitors,
    getEdge,
    getPageSpeed,
}
