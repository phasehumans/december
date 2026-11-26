export type FreshOption = {
    fresh?: boolean
}

export type VisitorsWindow = FreshOption & {
    // 7, 30, 90 or 365 (the schema checks); Cloudflare keeps visitors for 90 days a query
    days: number
}

export type CloudflareConfig = {
    token: string
    accountId: string
    zoneId: string | null
    projects: string[]
}

export type PagesDeployment = {
    id: string
    short_id?: string
    environment?: string
    created_on?: string
    url?: string
    latest_stage?: { name?: string; status?: string; ended_on?: string | null }
    deployment_trigger?: {
        type?: string
        metadata?: { branch?: string; commit_hash?: string; commit_message?: string }
    }
}

export type CountGroup<D> = { count: number; sum?: Record<string, number>; dimensions: D }

// what Cloudflare's GraphQL Analytics API answers to the queries in the service

export type RumGroups = {
    viewer: {
        accounts: Array<{
            sites: Array<CountGroup<{ requestHost: string }>>
            pages: Array<CountGroup<{ requestPath: string }>>
            referrers: Array<CountGroup<{ refererHost: string }>>
        }>
    }
}

export type ZoneGroups = {
    viewer: {
        zones: Array<{
            statuses: Array<CountGroup<{ edgeResponseStatus: number }>>
            cache: Array<CountGroup<{ cacheStatus: string }>>
        }>
    }
}

export type VitalsGroups = {
    viewer: {
        accounts: Array<{
            vitals: Array<{
                count: number
                dimensions: { requestHost: string }
                quantiles: {
                    largestContentfulPaintP75: number
                    interactionToNextPaintP75: number
                    cumulativeLayoutShiftP75: number
                }
                sum: {
                    lcpGood: number
                    lcpTotal: number
                    inpGood: number
                    inpTotal: number
                    clsGood: number
                    clsTotal: number
                }
            }>
        }>
    }
}
