import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// K10 to K12: overview, analytics and system read real rows
describe('admin overview, analytics and system', () => {
    const stamp = Date.now()
    const adminEmail = `stats-admin-${stamp}@example.com`
    const savedAdminEmails = process.env.ADMIN_EMAILS

    let admin: { userId: string; token: string }
    let member: { userId: string; token: string }
    let other: { userId: string; token: string }

    const get = (path: string, token = admin.token) =>
        request(app)
            .get(`/api/v1/admin${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Origin', 'http://localhost:3000')
            .set('Cookie', `accessToken=${token}`)

    beforeAll(async () => {
        process.env.ADMIN_EMAILS = adminEmail
        admin = await createSignedInUser({ email: adminEmail })
        await prisma.authSession.updateMany({
            where: { userId: admin.userId },
            data: { adminVerifiedAt: new Date() },
        })
        other = await createSignedInUser({ email: `stats-other-${stamp}@example.com` })

        // a new user who got all the way to a merged pull request, with usage today
        member = await createSignedInUser({ email: `stats-member-${stamp}@example.com` })
        await prisma.user.update({
            where: { id: member.userId },
            data: { onboardingCompletedAt: new Date(), githubConnected: true },
        })
        const session = await prisma.session.create({
            data: {
                userId: member.userId,
                title: 'stats run',
                prNumber: 1,
                prOpenedAt: new Date(),
                prMergedAt: new Date(),
                prAdditions: 30,
                prDeletions: 10,
            },
        })
        await prisma.session.create({
            data: { userId: member.userId, title: 'failed run', vmStatus: 'FAILED' },
        })
        await prisma.usageEvent.createMany({
            data: [
                {
                    userId: member.userId,
                    sessionId: session.id,
                    model: `stats-model-${stamp}`,
                    costInCents: 12.5,
                    totalTokens: 1000,
                    billingSource: 'CREDITS',
                    periodStart: new Date(),
                    periodEnd: new Date(),
                },
                {
                    // a CLI call: the proxy marks it "proxy-..."
                    userId: member.userId,
                    model: `stats-model-${stamp}`,
                    costInCents: 2,
                    totalTokens: 100,
                    billingSource: 'CREDITS',
                    externalRequestId: `proxy-${stamp}`,
                    periodStart: new Date(),
                    periodEnd: new Date(),
                },
                {
                    // a web call with no session (smart search): not the CLI
                    userId: member.userId,
                    model: `stats-model-${stamp}`,
                    costInCents: 1,
                    totalTokens: 10,
                    billingSource: 'CREDITS',
                    externalRequestId: `search-filters:${member.userId}:${stamp}`,
                    periodStart: new Date(),
                    periodEnd: new Date(),
                },
            ],
        })
        await prisma.walletTransaction.create({
            data: {
                userId: member.userId,
                amountInCents: 500,
                provider: 'RAZORPAY',
                status: 'SUCCESS',
            },
        })
    })

    afterAll(async () => {
        process.env.ADMIN_EMAILS = savedAdminEmails
        await prisma.session.deleteMany({ where: { userId: member.userId } })
        for (const id of [admin.userId, member.userId, other.userId]) {
            await cleanupTestUser({ id })
        }
    })

    it('a user who is not the admin gets the plain 404 on every stats route', async () => {
        for (const path of [
            '/overview',
            '/analytics/trend',
            '/system/public-status',
            '/system/deploys',
            '/system/edge',
            '/system/page-speed',
            '/analytics/visitors',
            '/analytics',
            '/system/health',
            '/system/failed-jobs',
        ]) {
            const res = await get(path, other.token)
            expect([path, res.status]).toEqual([path, 404])
        }
    })

    it('refuses a window over 90 days (G1)', async () => {
        const res = await get('/analytics?days=365')
        expect(res.status).toBe(400)
    })

    it('overview counts today and the things that need the admin', async () => {
        const res = await get('/overview')
        expect(res.status).toBe(200)
        const data = res.body.data
        expect(data.signupsToday).toBeGreaterThanOrEqual(3)
        expect(data.activeDay).toBeGreaterThanOrEqual(1)
        expect(data.creditsSpentTodayCents).toBeGreaterThanOrEqual(14.5)
        expect(data.paid30dCents).toBeGreaterThanOrEqual(500)
        expect(data.signups7d).toBeGreaterThanOrEqual(3)
        // the system's state is on the System tab only
        expect(data.systemStatus).toBeUndefined()
        expect(data.publicStatus).toBeUndefined()
        expect(typeof data.needsYou.pendingRequests).toBe('number')
    })

    it('the overview chart has every day, with all five lines (O1)', async () => {
        const res = await get('/analytics/trend?days=7')
        expect(res.status).toBe(200)
        const { days, points } = res.body.data
        expect(days).toBe(7)
        expect(points).toHaveLength(7)
        expect(Object.keys(points[0]).sort()).toEqual(
            ['active', 'creditsCents', 'day', 'paidCents', 'sessions', 'signups'].sort()
        )
        const today = points.at(-1)
        expect(today.signups).toBeGreaterThanOrEqual(3)
        expect(today.active).toBeGreaterThanOrEqual(1)
        expect(today.creditsCents).toBeGreaterThanOrEqual(14)
        expect(res.body.data.bucket).toBe('day')
        expect((await get('/analytics/trend?days=91')).status).toBe(400)
        expect((await get('/analytics/trend?days=14')).status).toBe(400)

        // a year is 52 weeks, each keyed by its Monday, this week last
        const year = await get('/analytics/trend?days=365')
        expect(year.status).toBe(200)
        expect(year.body.data.bucket).toBe('week')
        expect(year.body.data.points).toHaveLength(52)
        const thisWeek = year.body.data.points.at(-1)
        expect(new Date(`${thisWeek.day}T00:00:00Z`).getUTCDay()).toBe(1)
        expect(thisWeek.signups).toBeGreaterThanOrEqual(today.signups)
    })

    it('analytics: signups, funnel, active users, cohorts, money and pull requests', async () => {
        const res = await get('/analytics?days=7')
        expect(res.status).toBe(200)
        const data = res.body.data

        // A2: six steps, from signup to merged PR
        expect(Object.keys(data.funnel).sort()).toEqual(
            ['connectedGit', 'onboarded', 'prMerged', 'prOpened', 'ranAgent', 'signedUp'].sort()
        )
        expect(data.funnel.signedUp).toBeGreaterThanOrEqual(3)
        expect(data.funnel.onboarded).toBeGreaterThanOrEqual(1)
        expect(data.funnel.connectedGit).toBeGreaterThanOrEqual(1)
        expect(data.funnel.ranAgent).toBeGreaterThanOrEqual(1)
        expect(data.funnel.prMerged).toBeGreaterThanOrEqual(1)
        expect(data.funnel.prMerged).toBeLessThanOrEqual(data.funnel.prOpened)

        // A3: the web app and the CLI this week
        const channel = (name: string) =>
            data.channels
                .filter((row: any) => row.channel === name)
                .reduce((sum: number, row: any) => sum + row.users, 0)
        expect(channel('web')).toBeGreaterThanOrEqual(1)
        expect(channel('cli')).toBeGreaterThanOrEqual(1)

        // A4: two sessions, one merged PR, one failed run
        expect(data.outcomes.sessions).toBeGreaterThanOrEqual(2)
        expect(data.outcomes.merged).toBeGreaterThanOrEqual(1)
        expect(data.outcomes.failed).toBeGreaterThanOrEqual(1)
        expect(data.outcomes.additions).toBeGreaterThanOrEqual(30)
        expect(typeof data.outcomes.medianMergeHours).toBe('number')

        // A5: of the active users, the member used the CLI
        expect(data.features.active).toBeGreaterThanOrEqual(1)
        expect(data.features.cli).toBeGreaterThanOrEqual(1)

        // A6: the member's model, with its calls and spend
        const model = data.models.find((row: any) => row.model === `stats-model-${stamp}`)
        expect(model).toMatchObject({ calls: 3, cents: 16 })

        // A7
        expect(data.signupMethods.email).toBeGreaterThanOrEqual(3)
        expect(typeof data.referrals.joined).toBe('number')

        // A10: the signups bars are gone (the trend chart has them), A9 is not built
        expect(data.signups).toBeUndefined()
        expect(data.topUsers).toBeUndefined()

        // K3
        expect(data.active.day).toBeGreaterThanOrEqual(1)
        const thisWeek = data.cohorts.cells.find((cell: any) => cell.week === 0)
        expect(thisWeek.users).toBeGreaterThanOrEqual(1)

        // K4
        const paid = data.wallet.filter((row: any) => row.provider === 'RAZORPAY')
        expect(paid.reduce((sum: number, row: any) => sum + row.cents, 0)).toBeGreaterThanOrEqual(
            500
        )
        expect(data.spent.reduce((sum: number, row: any) => sum + row.cents, 0)).toBeGreaterThan(0)

        // K5
        const merged = data.prWeeks.filter((row: any) => row.kind === 'merged')
        expect(merged.reduce((sum: number, row: any) => sum + row.count, 0)).toBeGreaterThanOrEqual(
            1
        )

        // removed views are not sent
        for (const gone of ['timezones', 'heatmap', 'topSpenders', 'runningLow']) {
            expect(data[gone]).toBeUndefined()
        }
        for (const path of ['/analytics/growth', '/analytics/usage']) {
            expect((await get(path)).status).toBe(404)
        }
    })

    it('the public status is empty in tests: the server never calls Better Stack here', async () => {
        const res = await get('/system/public-status')
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual({
            available: false,
            overall: null,
            announcement: null,
            services: [],
            days: [],
        })
    })

    it('Cloudflare deploys: not connected in tests, so the server never calls Cloudflare', async () => {
        const res = await get('/system/deploys')
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual({ connected: false, projects: [] })
    })

    it('Cloudflare visitors, edge and page speed: not connected in tests, and the window is checked', async () => {
        for (const path of ['/analytics/visitors?days=30', '/system/edge', '/system/page-speed']) {
            const res = await get(path)
            expect([path, res.status, res.body.data]).toEqual([path, 200, { connected: false }])
        }
        expect((await get('/analytics/visitors?days=365')).status).toBe(200)
        expect((await get('/analytics/visitors?days=14')).status).toBe(400)
    })

    it('system health answers even when parts are down, with no job data', async () => {
        const res = await get('/system/health')
        expect(res.status).toBe(200)
        const data = res.body.data
        expect(['ok', 'warn', 'down']).toContain(data.status)
        expect(data.database.status).toBe('ok')
        expect(data.queues.items.map((q: any) => q.name)).toEqual([
            'agent_jobs',
            'sweep_jobs',
            'email_jobs',
            'minio_wipe',
        ])
        expect(data.errors.hourly).toHaveLength(24)
        // E1 and E2: the machine the server runs on
        expect(data.machine.cores).toBeGreaterThan(0)
        expect(data.machine.diskUsedPct).toBeGreaterThanOrEqual(0)
        expect(data.machine.memoryText).toContain('of')

        const fresh = await get('/system/health?fresh=1')
        expect(fresh.status).toBe(200)

        const failed = await get('/system/failed-jobs')
        expect(failed.status).toBe(200)
        for (const job of failed.body.data.items) {
            expect(job.data).toBeUndefined()
        }
    })
})
