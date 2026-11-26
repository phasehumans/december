import { prisma } from '@december/database'
import { setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { buildUnsubscribeUrl } from '../../src/modules/admin/admin.utils'
import { emailService } from '../../src/modules/email/email.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// #624 part 3: admin page api
describe('admin api', () => {
    const stamp = Date.now()
    const adminEmail = `admin-${stamp}@example.com`
    const unverifiedAdminEmail = `admin-unverified-${stamp}@example.com`
    const savedAdminEmails = process.env.ADMIN_EMAILS
    const savedSendMessage = emailService.sendMessageEmail
    const sentTo: string[] = []
    const sentMessages: any[] = []
    const queued: Array<{ name: string; data: any }> = []

    let admin: { userId: string; token: string }
    let unverifiedAdmin: { userId: string; token: string }
    let member: { userId: string; token: string }
    const extraUserIds: string[] = []

    const APP_ORIGIN = 'http://localhost:3000'

    // the admin api takes only the web cookie from the web app's origin (S2, S3)
    const as = (token: string, origin: string = APP_ORIGIN) => ({
        get: (path: string) =>
            request(app)
                .get(`/api/v1/admin${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Origin', origin)
                .set('Cookie', `accessToken=${token}`),
        post: (path: string, body: object = {}) =>
            request(app)
                .post(`/api/v1/admin${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Origin', origin)
                .set('Cookie', `accessToken=${token}`)
                .send(body),
    })

    const setCodeEnteredAt = (userId: string, at: Date | null) =>
        prisma.authSession.updateMany({ where: { userId }, data: { adminVerifiedAt: at } })

    const auditRows = (action: string, targetId: string) =>
        prisma.adminAuditLog.count({ where: { action, targetId, adminUserId: admin.userId } })

    beforeAll(async () => {
        process.env.ADMIN_EMAILS = ` ${adminEmail.toUpperCase()} , ${unverifiedAdminEmail}`
        // a fake sender: tests never send a real email, they only record what would go out
        emailService.sendMessageEmail = (async (data: any) => {
            sentTo.push(data.to)
            sentMessages.push(data)
            return { id: `email-${sentTo.length}` }
        }) as any
        setAgentQueue({
            add: async (name: string, data: any) => {
                queued.push({ name, data })
                return { id: `job-${queued.length}` }
            },
        } as any)

        admin = await createSignedInUser({ email: adminEmail })
        unverifiedAdmin = await createSignedInUser({
            email: unverifiedAdminEmail,
            emailVerified: false,
        })
        member = await createSignedInUser({ email: `member-${stamp}@example.com` })
        // the admin entered an authenticator code in this sign-in just now
        await setCodeEnteredAt(admin.userId, new Date())
    })

    afterAll(async () => {
        process.env.ADMIN_EMAILS = savedAdminEmails
        emailService.sendMessageEmail = savedSendMessage
        setAgentQueue(null)
        const ids = [admin.userId, unverifiedAdmin.userId, member.userId, ...extraUserIds]
        await prisma.adminAuditLog.deleteMany({ where: { adminUserId: admin.userId } })
        await prisma.creditRequest.deleteMany({ where: { userId: { in: ids } } })
        await prisma.githubAppInstallation.deleteMany({
            where: { installationId: `inst-${stamp}` },
        })
        await prisma.announcement.deleteMany({ where: { createdBy: admin.userId } })
        await prisma.session.deleteMany({ where: { userId: { in: ids } } })
        for (const id of ids) {
            await cleanupTestUser({ id })
        }
    })

    describe('access', () => {
        const routes: Array<[string, string]> = [
            ['get', '/me'],
            ['post', '/totp/setup'],
            ['post', '/totp/verify'],
            ['get', '/overview'],
            ['get', '/analytics/growth'],
            ['get', '/system/health'],
            ['post', '/credit-requests/x/approve'],
            ['post', '/credit-requests/x/reject'],
            ['get', '/credit-ledger'],
            ['get', '/users'],
            ['post', '/users/x/credits'],
            ['get', '/sandboxes'],
            ['post', '/sandboxes/x/pause'],
        ]

        // S7: the same plain 404 an unknown path gets, so nobody can tell the api is there
        const expectHidden = (res: request.Response) => {
            expect(res.status).toBe(404)
            expect(res.text).toContain('Cannot')
        }

        it('a signed-in user who is not an admin gets a plain 404 on every admin route', async () => {
            for (const [method, path] of routes) {
                const res = await (as(member.token) as any)[method](path)
                expect([method, path, res.status]).toEqual([method, path, 404])
            }
        })

        it('an admin email that is not verified gets 404', async () => {
            expectHidden(await as(unverifiedAdmin.token).get('/me'))
        })

        it('signed out gets 404', async () => {
            expectHidden(
                await request(app)
                    .get('/api/v1/admin/me')
                    .set('x-forwarded-for', getRandomIP())
                    .set('Origin', APP_ORIGIN)
            )
        })

        it('the admin with a Bearer token (a CLI token) gets 404, even with the cookie too', async () => {
            expectHidden(
                await request(app)
                    .get('/api/v1/admin/me')
                    .set('x-forwarded-for', getRandomIP())
                    .set('Origin', APP_ORIGIN)
                    .set('Authorization', `Bearer ${admin.token}`)
            )
            expectHidden(
                await request(app)
                    .get('/api/v1/admin/me')
                    .set('x-forwarded-for', getRandomIP())
                    .set('Origin', APP_ORIGIN)
                    .set('Cookie', `accessToken=${admin.token}`)
                    .set('Authorization', `Bearer ${admin.token}`)
            )
        })

        it('S1: a CLI sign-in of the admin gets 404 even when its token is sent as a cookie', async () => {
            const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
            const cli = await prisma.authSession.create({
                data: {
                    userId: admin.userId,
                    refreshTokenHash: `cli-${stamp}-${Math.random()}`,
                    // what pollDeviceToken saves for every device-flow sign-in
                    userAgent: 'device-cli (curl/8.5.0)',
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                    adminVerifiedAt: new Date(),
                },
            })
            try {
                const token = generateAccessToken({ userId: admin.userId, sessionId: cli.id })
                expectHidden(await as(token).get('/me'))
                expectHidden(await as(token).get('/users'))
                expectHidden(await as(token).post('/totp/setup'))
            } finally {
                await prisma.authSession.delete({ where: { id: cli.id } })
            }
        })

        it('an expired token gets 401 only for the admin; anyone else gets the 404', async () => {
            const jwt = (await import('jsonwebtoken')).default
            const { env } = await import('../../src/env')
            const expired = (userId: string) =>
                jwt.sign({ userId, sessionId: 'x' }, env.ACCESS_TOKEN_SECRET, { expiresIn: -10 })
            const own = await as(expired(admin.userId)).get('/me')
            expect(own.status).toBe(401)
            expectHidden(await as(expired(member.userId)).get('/me'))
        })

        it('the admin cookie from another site gets 404', async () => {
            expectHidden(await as(admin.token, 'https://trydecember.com').get('/me'))
            expectHidden(await as(admin.token, 'https://evil.example').post('/users/x/credits'))
        })

        it('a revoked sign-in gets 404', async () => {
            const other = await createSignedInUser({ email: `admin-revoked-${stamp}@example.com` })
            extraUserIds.push(other.userId)
            process.env.ADMIN_EMAILS = `${process.env.ADMIN_EMAILS},admin-revoked-${stamp}@example.com`
            await prisma.authSession.updateMany({
                where: { userId: other.userId },
                data: { isRevoked: true },
            })
            expectHidden(await as(other.token).get('/me'))
        })

        it('the admin gets in, and is told the panel path and code state', async () => {
            const res = await as(admin.token).get('/me')
            expect(res.status).toBe(200)
            expect(res.body.data.email).toBe(adminEmail)
            expect(res.body.data.adminPath).toMatch(/^\//)
            expect(res.body.data.totp.verifiedUntil).not.toBeNull()
        })

        it('without a code in the last 12 hours, only /me and the code routes answer', async () => {
            await setCodeEnteredAt(admin.userId, new Date(Date.now() - 13 * 60 * 60 * 1000))
            try {
                const me = await as(admin.token).get('/me')
                expect(me.status).toBe(200)
                expect(me.body.data.totp.verifiedUntil).toBeNull()
                for (const path of ['/users', '/overview', '/credit-ledger', '/system/health']) {
                    const res = await as(admin.token).get(path)
                    expect([path, res.status, res.body.errors?.code]).toEqual([
                        path,
                        403,
                        'admin_code_required',
                    ])
                }
            } finally {
                await setCodeEnteredAt(admin.userId, new Date())
            }
        })

        it('only the admin is told the panel path in their profile', async () => {
            const own = await request(app)
                .get('/api/v1/setting')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${admin.token}`)
            const other = await request(app)
                .get('/api/v1/setting')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${member.token}`)
            expect(own.status).toBe(200)
            expect(own.body.data.isAdmin).toBe(true)
            expect(own.body.data.adminPath).toMatch(/^\//)
            expect(other.status).toBe(200)
            expect(other.body.data.isAdmin).toBe(false)
            expect(other.body.data.adminPath).toBeUndefined()
        })
    })

    describe('a1 credit requests', () => {
        let requester: { userId: string; token: string }
        let rejected: { userId: string; token: string }
        let approveId: string
        let rejectId: string

        const ask = (token: string) =>
            request(app)
                .post('/api/v1/billing/credit-request')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send({ buildPlan: 'a todo app', heardFrom: 'twitter', agreeToFeedback: true })

        beforeAll(async () => {
            requester = await createSignedInUser({ email: `requester-${stamp}@example.com` })
            rejected = await createSignedInUser({ email: `rejected-${stamp}@yopmail.com` })
            extraUserIds.push(requester.userId, rejected.userId)
            await ask(requester.token)
            approveId = (
                await prisma.creditRequest.findFirstOrThrow({ where: { userId: requester.userId } })
            ).id
            await ask(rejected.token)
            rejectId = (
                await prisma.creditRequest.findFirstOrThrow({ where: { userId: rejected.userId } })
            ).id
        })

        it('a new request goes to the admin inbox, not to their email', async () => {
            expect(sentTo.map((to) => to.toLowerCase())).not.toContain(adminEmail)
            const inbox = await prisma.notification.count({
                where: { userId: admin.userId, title: 'New free credit request' },
            })
            expect(inbox).toBeGreaterThanOrEqual(1)
        })

        it('the Asked for credits view lists waiting requests with signals', async () => {
            const res = await as(admin.token).get(`/users?filter=asked&q=rejected-${stamp}`)
            expect(res.status).toBe(200)
            const row = res.body.data.items[0]
            expect(row.email).toBe(`rejected-${stamp}@yopmail.com`)
            expect(row.disposable).toBe(true)
            expect(row.pendingRequest).toMatchObject({
                id: rejectId,
                buildPlan: 'a todo app',
                heardFrom: 'twitter',
            })
            expect(row.pendingRequest.signals.signupMethod).toBe('email')
            expect(typeof row.pendingRequest.signals.accountAgeDays).toBe('number')
            expect(typeof row.pendingRequest.signals.otherRequestsSameIp).toBe('number')
            expect(JSON.stringify(row)).not.toContain('ipAddress')
            expect((await as(admin.token).get('/credit-requests')).status).toBe(404)
            expect((await as(admin.token).get('/feedback')).status).toBe(404)
        })

        it('approving twice adds $5 once, with a notification and an audit row', async () => {
            const first = await as(admin.token).post(`/credit-requests/${approveId}/approve`)
            const second = await as(admin.token).post(`/credit-requests/${approveId}/approve`)
            expect(first.status).toBe(200)
            expect(second.status).toBe(409)

            const user = await prisma.user.findUniqueOrThrow({ where: { id: requester.userId } })
            expect(user.creditBalance).toBe(500)
            const grants = await prisma.walletTransaction.findMany({
                where: { userId: requester.userId, provider: 'GRANT' },
            })
            expect(grants).toHaveLength(1)
            expect(grants[0]!.status).toBe('SUCCESS')
            const notes = await prisma.notification.count({ where: { userId: requester.userId } })
            expect(notes).toBe(1)
            expect(await auditRows('credit_request.approve', approveId)).toBe(1)
        })

        it('a rejection is final: the email cannot request again', async () => {
            const res = await as(admin.token).post(`/credit-requests/${rejectId}/reject`, {
                reason: 'throwaway inbox',
            })
            expect(res.status).toBe(200)
            expect(await auditRows('credit_request.reject', rejectId)).toBe(1)

            const again = await ask(rejected.token)
            expect(again.status).toBe(409)
            const status = await request(app)
                .get('/api/v1/billing/credit-request')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${rejected.token}`)
            expect(status.body.data.status).toBe('REJECTED')
            expect(status.body.data.rejectReason).toBe('throwaway inbox')
        })
    })

    describe('users tab', () => {
        it('adds credits and audits it; taking credits away is not allowed', async () => {
            const add = await as(admin.token).post(`/users/${member.userId}/credits`, {
                amountInCents: 300,
            })
            expect(add.status).toBe(200)
            expect(add.body.data.creditBalance).toBe(300)

            const remove = await as(admin.token).post(`/users/${member.userId}/credits`, {
                amountInCents: -100,
            })
            expect(remove.status).toBe(400)
            const withReason = await as(admin.token).post(`/users/${member.userId}/credits`, {
                amountInCents: 100,
                reason: 'not asked for any more',
            })
            expect(withReason.status).toBe(400)
            expect(await auditRows('credits.adjust', member.userId)).toBe(1)
        })

        it('the user gets an inbox note and an email when credits are added', async () => {
            const target = await createSignedInUser({ email: `added-${stamp}@example.com` })
            extraUserIds.push(target.userId)
            sentTo.length = 0
            const res = await as(admin.token).post(`/users/${target.userId}/credits`, {
                amountInCents: 200,
            })
            expect(res.status).toBe(200)
            const note = await prisma.notification.findFirst({
                where: { userId: target.userId, title: 'Credits added' },
            })
            expect(note?.message).toBe('$2.00 is in your wallet.')
            expect(note?.link).toBe('/settings/billing')
            expect(sentTo.map((to) => to.toLowerCase())).toContain(`added-${stamp}@example.com`)
        })

        it('added credits stop at the 24-hour cap, and the ledger shows the cap', async () => {
            const target = await createSignedInUser({ email: `cap-${stamp}@example.com` })
            extraUserIds.push(target.userId)
            const before = await as(admin.token).get('/credit-ledger')
            expect(before.status).toBe(200)
            const { usedCents, capCents } = before.body.data.cap
            const over = Math.max(1, capCents - usedCents + 1)
            const res = await as(admin.token).post(`/users/${target.userId}/credits`, {
                amountInCents: over,
            })
            expect(res.status).toBe(400)
            expect(res.body.message).toContain('24-hour limit')
        })

        it('lists users newest signup first, a page at a time, with search', async () => {
            const older = await createSignedInUser({
                email: `page-old-${stamp}@example.com`,
                createdAt: new Date(Date.now() - 60 * 1000),
            })
            const newer = await createSignedInUser({ email: `page-new-${stamp}@example.com` })
            extraUserIds.push(older.userId, newer.userId)
            await prisma.usageEvent.create({
                data: {
                    userId: older.userId,
                    model: 'm',
                    periodStart: new Date(),
                    periodEnd: new Date(),
                },
            })

            const first = await as(admin.token).get(`/users?q=page-&page=1&pageSize=1`)
            expect(first.status).toBe(200)
            expect(first.body.data).toMatchObject({ page: 1, pageSize: 1 })
            expect(first.body.data.total).toBeGreaterThanOrEqual(2)
            expect(first.body.data.items[0].email).toBe(`page-new-${stamp}@example.com`)
            // only what the table shows
            expect(Object.keys(first.body.data.items[0]).sort()).toEqual(
                [
                    'createdAt',
                    'creditBalance',
                    'disposable',
                    'email',
                    'id',
                    'lastActiveAt',
                    'latestFeedback',
                    'name',
                    'pendingRequest',
                ].sort()
            )

            const second = await as(admin.token).get(`/users?q=page-old-${stamp}`)
            expect(second.body.data.items.map((u: any) => u.id)).toEqual([older.userId])
            expect(second.body.data.items[0].lastActiveAt).not.toBeNull()
        })

        it('filters: asked for credits, active this week, feedback', async () => {
            const idle = await createSignedInUser({ email: `filter-idle-${stamp}@example.com` })
            const busy = await createSignedInUser({ email: `filter-busy-${stamp}@example.com` })
            extraUserIds.push(idle.userId, busy.userId)
            await prisma.user.update({ where: { id: busy.userId }, data: { creditBalance: 900 } })
            await prisma.usageEvent.create({
                data: {
                    userId: busy.userId,
                    model: 'm',
                    periodStart: new Date(),
                    periodEnd: new Date(),
                },
            })
            await prisma.creditRequest.create({
                data: {
                    userId: idle.userId,
                    normalizedEmail: `filter-idle-${stamp}@example.com`,
                    buildPlan: 'a todo app',
                    heardFrom: 'x',
                },
            })
            const ids = async (filter: string) => {
                const res = await as(admin.token).get(`/users?q=filter-&filter=${filter}`)
                expect(res.status).toBe(200)
                return res.body.data.items.map((u: any) => u.id).sort()
            }
            expect((await as(admin.token).get('/users?filter=never')).status).toBe(400)
            expect((await as(admin.token).get('/users?filter=low')).status).toBe(400)
            expect(await ids('asked')).toEqual([idle.userId])
            // both signed in just now, so both count as active
            expect(await ids('active')).toEqual([idle.userId, busy.userId].sort())
            expect(await ids('all')).toEqual([idle.userId, busy.userId].sort())
            expect((await as(admin.token).get('/users?filter=rich')).status).toBe(400)

            // M4: users who sent feedback, newest feedback first, with the latest message
            await prisma.feedback.create({
                data: {
                    userId: busy.userId,
                    feedback: 'older note',
                    createdAt: new Date(Date.now() - 60000),
                },
            })
            await prisma.feedback.create({ data: { userId: idle.userId, feedback: 'newest note' } })
            await prisma.feedback.create({
                data: {
                    userId: busy.userId,
                    feedback: 'busy again',
                    createdAt: new Date(Date.now() - 30000),
                },
            })
            const sent = await as(admin.token).get('/users?q=filter-&filter=feedback')
            expect(sent.status).toBe(200)
            expect(sent.body.data.total).toBe(2)
            expect(sent.body.data.items.map((u: any) => [u.id, u.latestFeedback.feedback])).toEqual(
                [
                    [idle.userId, 'newest note'],
                    [busy.userId, 'busy again'],
                ]
            )
            await prisma.creditRequest.deleteMany({ where: { userId: idle.userId } })
        })

        it('the details card shows real numbers and nothing secret', async () => {
            const target = await createSignedInUser({ email: `card-${stamp}@mailinator.com` })
            extraUserIds.push(target.userId)
            await prisma.user.update({
                where: { id: target.userId },
                data: { githubConnected: true, githubUsername: 'octo', githubToken: 'gho_secret' },
            })
            await prisma.session.create({
                data: {
                    userId: target.userId,
                    prNumber: 7,
                    prMergedAt: new Date(),
                    githubRepoOwner: 'secret-owner',
                    githubRepoName: 'secret-repo',
                    title: 'private session title',
                },
            })
            await prisma.usageEvent.create({
                data: {
                    userId: target.userId,
                    model: 'claude-x',
                    costInCents: 123.4,
                    externalRequestId: `proxy-card-${stamp}`,
                    periodStart: new Date(),
                    periodEnd: new Date(),
                },
            })
            await prisma.feedback.create({
                data: { userId: target.userId, feedback: 'love it', rating: 'good' },
            })

            await as(admin.token).post(`/users/${target.userId}/credits`, { amountInCents: 100 })

            const res = await as(admin.token).get(`/users/${target.userId}`)
            expect(res.status).toBe(200)
            const card = res.body.data
            expect(card).toMatchObject({
                email: `card-${stamp}@mailinator.com`,
                disposable: true,
                account: { signupMethod: 'email', googleLinked: false },
                connected: { github: { username: 'octo', appInstalled: false }, secrets: 0 },
                sessions: { total: 1, repos: 1 },
                prs: { opened: 1, merged: 1, closed: 0 },
                usage: {
                    calls: 1,
                    cliCalls: 1,
                    spentCents: 123,
                    spentDayCents: 123,
                    topModels: [{ model: 'claude-x', calls: 1, cents: 123 }],
                },
                money: { balanceCents: 100, freeCents: 100 },
                feedback: { total: 1 },
            })
            expect(card.usage.daily).toHaveLength(1)
            expect(card.adminHistory[0]).toMatchObject({
                action: 'credits.adjust',
                amountInCents: 100,
            })
            expect(card.devices.length).toBeGreaterThanOrEqual(1)
            expect(card.lastActiveAt).not.toBeNull()
            const raw = JSON.stringify(card)
            for (const secret of [
                'secret-repo',
                'private session title',
                'gho_secret',
                'githubToken',
                'otpHash',
                'refreshTokenHash',
                'ipAddress',
            ]) {
                expect(raw).not.toContain(secret)
            }
            expect((await as(admin.token).get('/users/no-such-user')).status).toBe(404)
            expect((await as(member.token).get(`/users/${target.userId}`)).status).toBe(404)
        })

        it('the removed user routes are gone', async () => {
            expect((await as(admin.token).post(`/users/${member.userId}/restore`)).status).toBe(404)
            expect((await as(admin.token).get('/github-installations')).status).toBe(404)
        })
    })

    describe('unsubscribe links in emails already sent', () => {
        it('the unsubscribe link asks first, then turns product emails off', async () => {
            const url = new URL(buildUnsubscribeUrl(member.userId))
            const u = url.searchParams.get('u') as string
            const t = url.searchParams.get('t') as string

            // opening the link (or a link scanner) changes nothing
            const page = await request(app)
                .get(`${url.pathname}${url.search}`)
                .set('x-forwarded-for', getRandomIP())
            expect(page.status).toBe(200)
            expect(page.text).toContain('method="post"')
            let user = await prisma.user.findUniqueOrThrow({ where: { id: member.userId } })
            expect(user.notifyProductUpdates).toBe(true)

            const confirm = await request(app)
                .post(url.pathname)
                .set('x-forwarded-for', getRandomIP())
                .type('form')
                .send({ u, t })
            expect(confirm.status).toBe(200)
            user = await prisma.user.findUniqueOrThrow({ where: { id: member.userId } })
            expect(user.notifyProductUpdates).toBe(false)

            const forged = await request(app)
                .post(url.pathname)
                .set('x-forwarded-for', getRandomIP())
                .type('form')
                .send({ u: admin.userId, t })
            expect(forged.status).toBe(400)
        })
    })

    describe('a9 sandboxes', () => {
        it('lists running sandboxes and pauses or stops one through the worker, audited', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: member.userId,
                    title: 'busy',
                    vmId: `vm-${stamp}`,
                    sandboxStatus: 'RUNNING',
                    vmLastActivityAt: new Date(),
                },
            })
            const list = await as(admin.token).get('/sandboxes')
            expect(list.body.data.items.map((s: any) => s.sessionId)).toContain(session.id)
            // B12: no session titles, they are the user's own work
            expect(JSON.stringify(list.body.data)).not.toContain('"title"')

            const pause = await as(admin.token).post(`/sandboxes/${session.id}/pause`)
            expect(pause.status).toBe(200)
            const stop = await as(admin.token).post(`/sandboxes/${session.id}/stop`)
            expect(stop.status).toBe(200)
            expect(queued.map((job) => [job.name, job.data.action, job.data.sandboxId])).toEqual([
                ['sandbox_control', 'pause', `vm-${stamp}`],
                ['sandbox_control', 'stop', `vm-${stamp}`],
            ])
            expect(await auditRows('sandbox.pause', session.id)).toBe(1)
            expect(await auditRows('sandbox.stop', session.id)).toBe(1)
        })
    })
    // L1 to L5: what one admin can give and send in 24 hours
    describe('limits', () => {
        const askFor = async (name: string) => {
            const user = await createSignedInUser({ email: `${name}-${stamp}@example.com` })
            extraUserIds.push(user.userId)
            await request(app)
                .post('/api/v1/billing/credit-request')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${user.token}`)
                .send({ buildPlan: 'a todo app', heardFrom: 'twitter', agreeToFeedback: true })
            const creditRequest = await prisma.creditRequest.findFirstOrThrow({
                where: { userId: user.userId },
            })
            return { user, requestId: creditRequest.id }
        }

        it('B10: a deleted account gets no credits, by request or by hand, and is not counted', async () => {
            const { user, requestId } = await askFor('limit-deleted')
            const before = (await as(admin.token).get('/overview')).body.data.needsYou
                .pendingRequests
            await prisma.user.update({
                where: { id: user.userId },
                data: { isDeleted: true, deletedAt: new Date() },
            })
            const after = (await as(admin.token).get('/overview')).body.data.needsYou
                .pendingRequests
            expect(after).toBe(before - 1)

            const approve = await as(admin.token).post(`/credit-requests/${requestId}/approve`)
            expect(approve.status).toBe(409)
            expect(approve.body.message).toContain('deleted')
            const add = await as(admin.token).post(`/users/${user.userId}/credits`, {
                amountInCents: 100,
            })
            expect(add.status).toBe(404)
            const grants = await prisma.walletTransaction.count({ where: { userId: user.userId } })
            expect(grants).toBe(0)
        })

        it('B9: the audit row is written with the money, in the same transaction', async () => {
            const { requestId } = await askFor('limit-audit')
            const res = await as(admin.token).post(`/credit-requests/${requestId}/approve`)
            expect(res.status).toBe(200)
            expect(await auditRows('credit_request.approve', requestId)).toBe(1)
        })

        it('one user gets at most $10 a day, approved $5 requests included', async () => {
            const { user, requestId } = await askFor('limit-user')
            const approved = await as(admin.token).post(`/credit-requests/${requestId}/approve`)
            expect(approved.status).toBe(200)

            const tooMuch = await as(admin.token).post(`/users/${user.userId}/credits`, {
                amountInCents: 501,
            })
            expect(tooMuch.status).toBe(400)
            expect(tooMuch.body.message).toContain('for this user')

            const fits = await as(admin.token).post(`/users/${user.userId}/credits`, {
                amountInCents: 500,
            })
            expect(fits.status).toBe(200)
        })

        it('a change of $10 or more goes to the admin inbox, not to email', async () => {
            const user = await createSignedInUser({ email: `limit-alert-${stamp}@example.com` })
            extraUserIds.push(user.userId)
            sentTo.length = 0
            const res = await as(admin.token).post(`/users/${user.userId}/credits`, {
                amountInCents: 1000,
            })
            expect(res.status).toBe(200)
            expect(sentTo).not.toContain(adminEmail)
            const inbox = await prisma.notification.findFirst({
                where: { userId: admin.userId, title: 'Credits added: $10.00' },
            })
            expect(inbox?.message).toContain(`limit-alert-${stamp}@example.com`)
        })

        it('approvals count toward the daily total of the admin', async () => {
            const saved = process.env.ADMIN_DAILY_CREDIT_CAP_CENTS
            const ledger = await as(admin.token).get('/credit-ledger')
            // room for less than one more $5 approval
            process.env.ADMIN_DAILY_CREDIT_CAP_CENTS = String(ledger.body.data.cap.usedCents + 400)
            try {
                const { requestId } = await askFor('limit-total')
                const res = await as(admin.token).post(`/credit-requests/${requestId}/approve`)
                expect(res.status).toBe(400)
                expect(res.body.message).toContain('for credits you give')
                const row = await prisma.creditRequest.findUniqueOrThrow({
                    where: { id: requestId },
                })
                expect(row.status).toBe('PENDING')
            } finally {
                process.env.ADMIN_DAILY_CREDIT_CAP_CENTS = saved
            }
        })
    })
})
