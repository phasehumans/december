import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cliDispatcher } from '../../src/modules/cli/cli.dispatcher'
import { appCache } from '../../src/shared/cache'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

const DAY_MS = 24 * 60 * 60 * 1000

describe('Smart session search (AI filters)', () => {
    const userEmail = `smartsearch-${Date.now()}@example.com`
    const brokeEmail = `smartsearchbroke-${Date.now()}@example.com`

    let userId: string
    let brokeUserId: string
    let userToken: string
    let brokeToken: string
    let recentStripeId: string
    let oldStripeId: string
    let gitlabId: string
    let resolveSpy: any
    // what the fake model replies, keyed by the query it gets
    const replies: Record<string, string> = {
        'stripe last week': '{"topic":["stripe"],"updatedWithinDays":7}',
        'stripe anytime please': '{"topic":["stripe"]}',
        'gitlab in acme-api': '{"topic":["gitlab"],"repo":"acme-api"}',
        'gitlab in made-up-repo': '{"topic":["gitlab"],"repo":"made-up-repo"}',
        'nonsense reply please': 'I cannot help with that.',
    }
    const modelCalls: string[] = []

    beforeAll(async () => {
        const mockProvider = {
            id: 'gemini',
            name: 'Gemini',
            stream: async function* (messages: any[]) {
                const query = messages[messages.length - 1]?.content || ''
                modelCalls.push(query)
                yield { type: 'text', text: replies[query] ?? '{}' }
                yield { type: 'usage', promptTokens: 400, completionTokens: 30 }
            },
        }
        resolveSpy = spyOn(cliDispatcher, 'resolveServerProvider').mockReturnValue({
            provider: mockProvider as any,
            providerName: 'gemini',
            model: 'gemini-3.5-flash-lite',
        })

        const user = await prisma.user.create({
            data: {
                email: userEmail,
                name: 'Smart Search User',
                emailVerified: true,
                creditBalance: 500,
            },
        })
        userId = user.id
        const broke = await prisma.user.create({
            data: {
                email: brokeEmail,
                name: 'Smart Search Broke User',
                emailVerified: true,
                creditBalance: 0,
            },
        })
        brokeUserId = broke.id

        const make = (title: string, repo: string) =>
            prisma.session.create({ data: { userId, title, githubRepoName: repo } })
        recentStripeId = (await make('Fix Stripe webhook retries', 'acme-api')).id
        oldStripeId = (await make('Stripe checkout v1', 'storefront')).id
        gitlabId = (await make('Add GitLab OAuth provider', 'acme-api')).id
        await prisma.session.update({
            where: { id: oldStripeId },
            data: { updatedAt: new Date(Date.now() - 30 * DAY_MS) },
        })

        userToken = authCookieToken(await signInWithEmailCode(app, userEmail))
        brokeToken = authCookieToken(await signInWithEmailCode(app, brokeEmail))
    })

    beforeEach(async () => {
        // filters are cached in memory and Redis; each test starts uncached
        await appCache.clearAll()
    })

    afterAll(async () => {
        resolveSpy?.mockRestore()
        for (const id of [userId, brokeUserId].filter(Boolean)) {
            await prisma.usageEvent.deleteMany({ where: { userId: id } })
            await prisma.session.deleteMany({ where: { userId: id } })
            await cleanupTestUser({ id })
        }
    })

    const search = (q: string | undefined, token = userToken) => {
        const req = request(app)
            .get('/api/v1/session/smart-search')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
        return q === undefined ? req : req.query({ q })
    }
    const ids = (res: any) => res.body.data.sessions.map((s: any) => s.id)
    const dailyEvent = () =>
        prisma.usageEvent.findFirst({
            where: { userId, externalRequestId: { startsWith: 'search-filters:' } },
        })

    it('validates the query and is not read as a session id', async () => {
        const res = await search(undefined)
        expect(res.status).toBe(400)
    })

    it('applies topic and time filters from the model', async () => {
        const res = await search('stripe last week')
        expect(res.status).toBe(200)
        expect(res.body.data.applied).toBe(true)
        expect(ids(res)).toEqual([recentStripeId])
    })

    it('reuses cached filters for the same text without a second model call', async () => {
        const before = modelCalls.length
        await search('Stripe  LAST week')
        await search('stripe last week')
        expect(modelCalls.length).toBe(before + 1)
    })

    it('charges every model call into one usage event per day', async () => {
        await prisma.usageEvent.deleteMany({ where: { userId } })
        const balanceBefore = (await prisma.user.findUnique({ where: { id: userId } }))!
            .creditBalance

        await search('stripe anytime please')
        await search('gitlab in acme-api')

        const event = await dailyEvent()
        expect(event).not.toBeNull()
        expect((event!.metadata as any).calls).toBe(2)
        expect(event!.inputTokens).toBe(800)
        expect(event!.outputTokens).toBe(60)
        expect(event!.costInCents).toBeGreaterThan(0)
        const events = await prisma.usageEvent.count({ where: { userId } })
        expect(events).toBe(1)

        const balanceAfter = (await prisma.user.findUnique({ where: { id: userId } }))!
            .creditBalance
        expect(balanceBefore - balanceAfter).toBeCloseTo(event!.costInCents, 6)
    })

    it('filters by a repo the user has and ignores one they do not', async () => {
        const known = await search('gitlab in acme-api')
        expect(ids(known)).toEqual([gitlabId])

        // the made-up repo is dropped, so the topic alone still finds the session
        const unknown = await search('gitlab in made-up-repo')
        expect(ids(unknown)).toEqual([gitlabId])
    })

    it('returns applied: false when the model reply is not usable', async () => {
        const res = await search('nonsense reply please')
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual({ applied: false, sessions: [] })
    })

    it('returns applied: false without calling the model when the user has no credits', async () => {
        const before = modelCalls.length
        const res = await search('stripe last week', brokeToken)
        expect(res.status).toBe(200)
        expect(res.body.data.applied).toBe(false)
        expect(modelCalls.length).toBe(before)
        const events = await prisma.usageEvent.count({ where: { userId: brokeUserId } })
        expect(events).toBe(0)
    })
})
