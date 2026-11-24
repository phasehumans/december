import { prisma } from '@december/database'
import { setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
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
    const queued: Array<{ name: string; data: any }> = []

    let admin: { userId: string; token: string }
    let unverifiedAdmin: { userId: string; token: string }
    let member: { userId: string; token: string }
    const extraUserIds: string[] = []

    const as = (token: string) => ({
        get: (path: string) =>
            request(app)
                .get(`/api/v1/admin${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        post: (path: string, body: object = {}) =>
            request(app)
                .post(`/api/v1/admin${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send(body),
    })

    const auditRows = (action: string, targetId: string) =>
        prisma.adminAuditLog.count({ where: { action, targetId, adminUserId: admin.userId } })

    beforeAll(async () => {
        process.env.ADMIN_EMAILS = ` ${adminEmail.toUpperCase()} , ${unverifiedAdminEmail}`
        emailService.sendMessageEmail = (async (data: { to: string }) => {
            sentTo.push(data.to)
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
    })

    afterAll(async () => {
        process.env.ADMIN_EMAILS = savedAdminEmails
        emailService.sendMessageEmail = savedSendMessage
        setAgentQueue(null)
        const ids = [admin.userId, unverifiedAdmin.userId, member.userId, ...extraUserIds]
        await prisma.adminAuditLog.deleteMany({ where: { adminUserId: admin.userId } })
        await prisma.creditRequest.deleteMany({ where: { userId: { in: ids } } })
        await prisma.redeemCode.deleteMany({
            where: { metadata: { path: ['code'], string_starts_with: `TEST${stamp}` } },
        })
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
            ['get', '/credit-requests'],
            ['post', '/credit-requests/x/approve'],
            ['post', '/credit-requests/x/reject'],
            ['get', '/feedback'],
            ['get', '/users'],
            ['get', '/users/x'],
            ['post', '/users/x/credits'],
            ['post', '/users/x/restore'],
            ['get', '/redeem-codes'],
            ['post', '/redeem-codes'],
            ['get', '/github-installations'],
            ['post', '/github-installations/x/assign'],
            ['get', '/announcements'],
            ['post', '/announcements/test'],
            ['post', '/announcements/send'],
            ['get', '/sandboxes'],
            ['post', '/sandboxes/x/pause'],
            ['post', '/sandboxes/x/stop'],
            ['get', '/usage/daily'],
            ['get', '/audit-log'],
        ]

        it('a signed-in user who is not an admin gets 403 on every admin route', async () => {
            for (const [method, path] of routes) {
                const res = await (as(member.token) as any)[method](path)
                expect([method, path, res.status]).toEqual([method, path, 403])
            }
        })

        it('an admin email that is not verified gets 403', async () => {
            const res = await as(unverifiedAdmin.token).get('/me')
            expect(res.status).toBe(403)
        })

        it('signed out gets 401', async () => {
            const res = await request(app)
                .get('/api/v1/admin/me')
                .set('x-forwarded-for', getRandomIP())
            expect(res.status).toBe(401)
        })

        it('the admin gets in', async () => {
            const res = await as(admin.token).get('/me')
            expect(res.status).toBe(200)
            expect(res.body.data.email).toBe(adminEmail)
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

        it('a new request emails the admins', () => {
            expect(sentTo.map((to) => to.toLowerCase())).toContain(adminEmail)
        })

        it('lists pending requests with signals', async () => {
            const res = await as(admin.token).get('/credit-requests?status=PENDING')
            expect(res.status).toBe(200)
            const row = res.body.data.items.find((item: any) => item.id === rejectId)
            expect(row.email).toBe(`rejected-${stamp}@yopmail.com`)
            expect(row.signals.disposableEmail).toBe(true)
            expect(row.signals.signupMethod).toBe('email')
            expect(typeof row.signals.accountAgeDays).toBe('number')
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

    describe('a3 credit changes and a5 users', () => {
        it('adds and removes credits with a reason, and audits it', async () => {
            const add = await as(admin.token).post(`/users/${member.userId}/credits`, {
                amountInCents: 300,
                reason: 'bug report',
            })
            expect(add.status).toBe(200)
            const remove = await as(admin.token).post(`/users/${member.userId}/credits`, {
                amountInCents: -100,
                reason: 'correction',
            })
            expect(remove.status).toBe(200)
            expect(remove.body.data.creditBalance).toBe(200)

            const tooMuch = await as(admin.token).post(`/users/${member.userId}/credits`, {
                amountInCents: -1000,
                reason: 'below zero',
            })
            expect(tooMuch.status).toBe(400)

            const detail = await as(admin.token).get(`/users/${member.userId}`)
            expect(detail.body.data.walletTransactions.map((t: any) => t.provider)).toEqual([
                'ADJUSTMENT',
                'ADJUSTMENT',
            ])
            expect(await auditRows('credits.adjust', member.userId)).toBe(2)
        })

        it('finds users by email and restores a deleted account', async () => {
            const search = await as(admin.token).get(`/users?q=member-${stamp}`)
            expect(search.body.data.items.map((u: any) => u.id)).toEqual([member.userId])

            await prisma.user.update({
                where: { id: member.userId },
                data: { isDeleted: true, deletedAt: new Date() },
            })
            const res = await as(admin.token).post(`/users/${member.userId}/restore`)
            expect(res.status).toBe(200)
            const user = await prisma.user.findUniqueOrThrow({ where: { id: member.userId } })
            expect(user.isDeleted).toBe(false)
            expect(await auditRows('user.restore', member.userId)).toBe(1)
        })
    })

    describe('a4 redeem codes', () => {
        it('creates a code a user can redeem, and audits it', async () => {
            const code = `TEST${stamp}`
            const res = await as(admin.token).post('/redeem-codes', {
                code,
                amountInCents: 250,
                maxRedemptions: 5,
            })
            expect(res.status).toBe(201)
            expect(await auditRows('redeem_code.create', res.body.data.id)).toBe(1)

            const redeem = await request(app)
                .post('/api/v1/billing/redeem-code')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${member.token}`)
                .send({ code: code.toLowerCase() })
            expect(redeem.status).toBe(200)

            const list = await as(admin.token).get('/redeem-codes')
            const row = list.body.data.items.find((item: any) => item.code === code)
            expect(row.claims.map((c: any) => c.email)).toEqual([`member-${stamp}@example.com`])
        })
    })

    describe('a6 github installations', () => {
        it('assigns an unclaimed installation to a user, and audits it', async () => {
            const installation = await prisma.githubAppInstallation.create({
                data: { installationId: `inst-${stamp}`, accountLogin: 'someone' },
            })
            const res = await as(admin.token).post(
                `/github-installations/${installation.id}/assign`,
                {
                    userId: member.userId,
                }
            )
            expect(res.status).toBe(200)
            const user = await prisma.user.findUniqueOrThrow({ where: { id: member.userId } })
            expect(user.githubAppInstall).toBe(true)
            expect(await auditRows('github_installation.assign', installation.id)).toBe(1)
        })
    })

    describe('a7 and a8 announcements', () => {
        it('a feedback request skips users with product emails turned off, and is kept in history', async () => {
            const daysAgo = 3000 + Math.floor(Math.random() * 1000)
            const signedUp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
            const optedIn = await createSignedInUser({
                email: `opted-in-${stamp}@example.com`,
                createdAt: signedUp,
            })
            const optedOut = await createSignedInUser({
                email: `opted-out-${stamp}@example.com`,
                createdAt: signedUp,
            })
            extraUserIds.push(optedIn.userId, optedOut.userId)
            await prisma.user.update({
                where: { id: optedOut.userId },
                data: { notifyProductUpdates: false },
            })
            sentTo.length = 0

            const res = await as(admin.token).post('/announcements/send', {
                kind: 'FEEDBACK_REQUEST',
                subject: 'quick ask',
                body: 'hi {name}, how was december?',
                signedUpDaysAgo: daysAgo,
            })
            expect(res.status).toBe(201)
            expect(res.body.data.recipientCount).toBe(1)
            expect(res.body.data.skippedCount).toBe(1)
            expect(sentTo).toEqual([`opted-in-${stamp}@example.com`])
            expect(await auditRows('announcement.send', res.body.data.id)).toBe(1)

            const history = await as(admin.token).get('/announcements')
            expect(history.body.data.items[0].id).toBe(res.body.data.id)
        })

        it('sends a test to the admin only', async () => {
            sentTo.length = 0
            const res = await as(admin.token).post('/announcements/test', {
                subject: 'hello',
                body: 'news',
            })
            expect(res.status).toBe(200)
            expect(sentTo).toEqual([adminEmail])
            const tests = await prisma.adminAuditLog.count({
                where: { adminUserId: admin.userId, action: 'announcement.test' },
            })
            expect(tests).toBe(1)
        })

        it('the unsubscribe link asks first, then turns product emails off', async () => {
            const link = await as(admin.token).get(`/users/${member.userId}`)
            const url = new URL(link.body.data.unsubscribeUrl)
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

    describe('a9 sandboxes and usage', () => {
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

        it('reports cost per model per day', async () => {
            await prisma.usageEvent.create({
                data: {
                    userId: member.userId,
                    model: `model-${stamp}`,
                    costInCents: 12.5,
                    periodStart: new Date(),
                    periodEnd: new Date(),
                },
            })
            const res = await as(admin.token).get('/usage/daily?days=2')
            expect(res.status).toBe(200)
            const row = res.body.data.items.find((item: any) => item.model === `model-${stamp}`)
            expect(row.costInCents).toBe(12.5)
        })
    })
})
