import { describe, expect, it } from 'bun:test'

import {
    APP_HOST,
    LANDING_HOST,
    getCloudflareConfig,
    microsToMs,
    shapeEdge,
    shapePageSpeed,
    shapeVisitors,
} from '../../src/modules/admincloudflare/admincloudflare.utils'

// the shapes below are what Cloudflare's GraphQL Analytics API answered for our account
// (numbers changed), so the shaping is tested without calling Cloudflare

describe('Cloudflare shaping (admin panel)', () => {
    it('C1, C2: visits per site, top pages, and our own landing page is not a referrer', () => {
        const shaped = shapeVisitors({
            days: 365,
            shownDays: 90,
            signups: 4,
            groups: {
                sites: [
                    { count: 45, sum: { visits: 30 }, dimensions: { requestHost: LANDING_HOST } },
                    { count: 50, sum: { visits: 10 }, dimensions: { requestHost: APP_HOST } },
                ],
                pages: [
                    { count: 40, dimensions: { requestPath: '' } },
                    { count: 0, dimensions: { requestPath: '/rare/' } },
                ],
                referrers: [
                    { count: 9, sum: { visits: 9 }, dimensions: { refererHost: '' } },
                    { count: 5, sum: { visits: 5 }, dimensions: { refererHost: LANDING_HOST } },
                    { count: 4, sum: { visits: 4 }, dimensions: { refererHost: 'www.google.com' } },
                    { count: 1, sum: { visits: 0 }, dimensions: { refererHost: 'rare.example' } },
                ],
            },
        })
        expect(shaped).toMatchObject({ requestedDays: 365, days: 90, signups: 4 })
        expect(shaped.landing).toEqual({ host: LANDING_HOST, visits: 30, pageViews: 45 })
        expect(shaped.app).toEqual({ host: APP_HOST, visits: 10, pageViews: 50 })
        expect(shaped.topPages).toEqual([{ path: '/', views: 40 }])
        expect(shaped.referrers).toEqual([
            { host: 'Direct', visits: 9 },
            { host: 'www.google.com', visits: 4 },
        ])
    })

    it('C4: requests, server errors, blocked, and the cache share of what could be cached', () => {
        const shaped = shapeEdge({
            statuses: [
                { count: 70, dimensions: { edgeResponseStatus: 200 } },
                { count: 20, dimensions: { edgeResponseStatus: 301 } },
                { count: 6, dimensions: { edgeResponseStatus: 403 } },
                { count: 1, dimensions: { edgeResponseStatus: 404 } },
                { count: 3, dimensions: { edgeResponseStatus: 502 } },
            ],
            cache: [
                { count: 80, dimensions: { cacheStatus: 'dynamic' } },
                { count: 15, dimensions: { cacheStatus: 'hit' } },
                { count: 5, dimensions: { cacheStatus: 'miss' } },
            ],
        })
        // 15 hits of 20 cacheable; the 80 dynamic ones never could be
        expect(shaped).toEqual({
            connected: true,
            error: null,
            requests: 100,
            serverErrors: 3,
            blocked: 6,
            cacheHitPct: 75,
        })
    })

    it('C5: page speed in ms, -1 means no data, and a site with no rows says so', () => {
        const shaped = shapePageSpeed({
            days: 30,
            rows: [
                {
                    count: 410,
                    dimensions: { requestHost: LANDING_HOST },
                    quantiles: {
                        largestContentfulPaintP75: 1148000,
                        interactionToNextPaintP75: -1,
                        cumulativeLayoutShiftP75: 0.0123,
                    },
                    sum: {
                        lcpGood: 97,
                        lcpTotal: 100,
                        inpGood: 0,
                        inpTotal: 0,
                        clsGood: 10,
                        clsTotal: 10,
                    },
                },
            ],
        })
        expect(shaped.sites[0]).toEqual({
            host: LANDING_HOST,
            label: 'Landing page',
            samples: 410,
            lcpMs: 1148,
            inpMs: null,
            cls: 0.012,
            lcpGoodPct: 97,
            inpGoodPct: null,
            clsGoodPct: 100,
        })
        expect(shaped.sites[1]).toMatchObject({ host: APP_HOST, samples: 0, lcpMs: null })
        expect(microsToMs(2500000)).toBe(2500)
    })

    it('reads the settings, and only safe Pages project names', () => {
        const saved = { ...process.env }
        try {
            delete process.env.CLOUDFLARE_API_TOKEN
            expect(getCloudflareConfig()).toBeNull()
            process.env.CLOUDFLARE_API_TOKEN = ' token '
            process.env.CLOUDFLARE_ACCOUNT_ID = 'acc'
            process.env.CLOUDFLARE_PAGES_PROJECTS = 'december, december-landing,../x,'
            expect(getCloudflareConfig()).toEqual({
                token: 'token',
                accountId: 'acc',
                zoneId: process.env.CLOUDFLARE_ZONE_ID?.trim() || null,
                projects: ['december', 'december-landing'],
            })
        } finally {
            process.env = saved
        }
    })
})
