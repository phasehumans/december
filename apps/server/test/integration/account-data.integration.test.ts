import { prisma } from '@december/database'
import { setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { ensureStorageBucket } from '../../src/config/s3'
import { authService } from '../../src/modules/auth/auth.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const authed = (token: string) => ({
    get: (path: string) =>
        request(app)
            .get(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`),
    delete: (path: string, body?: object) => {
        const req = request(app)
            .delete(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
        return body ? req.send(body) : req
    },
})

const recordJobs = (queuedJobs: Array<{ name: string; data: any }>) =>
    setAgentQueue({
        add: async (name: string, data: any) => {
            queuedJobs.push({ name, data })
            return { id: `job-${queuedJobs.length}` }
        },
    } as any)

const failJobs = () =>
    setAgentQueue({
        add: async () => {
            throw new Error('redis is down')
        },
    } as any)

// #636 part 3: delete all sessions, delete account and the 90-day purge
describe('account data api', () => {
    const stamp = Date.now()
    const queuedJobs: Array<{ name: string; data: any }> = []
    const userIds: string[] = []

    beforeAll(() => {
        recordJobs(queuedJobs)
    })

    afterAll(async () => {
        setAgentQueue(null)
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    it('the data export routes are gone', async () => {
        const user = await createSignedInUser({ email: `no-export-${stamp}@example.com` })
        userIds.push(user.userId)
        const res = await authed(user.token).get('/setting/export')
        expect(res.status).toBe(404)
    })

    describe('delete all sessions', () => {
        let user: { userId: string; token: string }
        let other: { userId: string; token: string }
        let runningId: string
        let otherSessionId: string

        beforeAll(async () => {
            user = await createSignedInUser({ email: `delete-all-${stamp}@example.com` })
            other = await createSignedInUser({ email: `delete-all-other-${stamp}@example.com` })
            userIds.push(user.userId, other.userId)
        })

        beforeEach(async () => {
            queuedJobs.length = 0
            await prisma.session.deleteMany({ where: { userId: user.userId } })
            const running = await prisma.session.create({
                data: {
                    userId: user.userId,
                    title: 'running',
                    vmId: 'sbx-running',
                    sandboxStatus: 'RUNNING',
                    messages: { create: [{ role: 'USER', content: 'hi', sequence: 1 }] },
                },
            })
            runningId = running.id
            await prisma.session.create({
                data: {
                    userId: user.userId,
                    title: 'stopped',
                    vmId: 'sbx-stopped',
                    sandboxStatus: 'STOPPED',
                },
            })
            await prisma.session.create({ data: { userId: user.userId, title: 'no sandbox' } })
            if (!otherSessionId) {
                const kept = await prisma.session.create({
                    data: { userId: other.userId, title: 'keep me', vmId: 'sbx-other' },
                })
                otherSessionId = kept.id
            }
        })

        it('needs the typed confirm', async () => {
            const res = await authed(user.token).delete('/session')
            expect(res.status).toBe(400)

            const wrong = await authed(user.token).delete('/session', { confirm: 'yes' })
            expect(wrong.status).toBe(400)
            expect(await prisma.session.count({ where: { userId: user.userId } })).toBe(3)
        })

        it('stops the live sandboxes, then deletes every session of the user', async () => {
            const res = await authed(user.token).delete('/session', { confirm: 'delete' })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ deleted: 3, sandboxesStopped: 1 })
            expect(queuedJobs).toEqual([
                {
                    name: 'sandbox_control',
                    data: {
                        taskType: 'sandbox_control',
                        action: 'stop',
                        sessionId: runningId,
                        sandboxId: 'sbx-running',
                    },
                },
            ])
            expect(await prisma.session.count({ where: { userId: user.userId } })).toBe(0)
            expect(await prisma.message.count({ where: { sessionId: runningId } })).toBe(0)

            // another user's session stays
            expect(
                await prisma.session.findUnique({ where: { id: otherSessionId } })
            ).not.toBeNull()
        })

        it('deletes nothing when the sandbox stops cannot be queued', async () => {
            failJobs()
            try {
                const res = await authed(user.token).delete('/session', { confirm: 'delete' })
                expect(res.status).toBe(503)
                expect(await prisma.session.count({ where: { userId: user.userId } })).toBe(3)
            } finally {
                recordJobs(queuedJobs)
            }
        })

        it('works when there is nothing to delete', async () => {
            await prisma.session.deleteMany({ where: { userId: user.userId } })
            const res = await authed(user.token).delete('/session', { confirm: 'delete' })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ deleted: 0, sandboxesStopped: 0 })
        })
    })

    describe('delete account', () => {
        it('stops live sandboxes and removes secrets and mcp servers', async () => {
            const user = await createSignedInUser({ email: `delete-account-${stamp}@example.com` })
            userIds.push(user.userId)
            queuedJobs.length = 0
            const running = await prisma.session.create({
                data: {
                    userId: user.userId,
                    title: 'running',
                    vmId: 'sbx-account',
                    sandboxStatus: 'RUNNING',
                },
            })
            await prisma.secret.create({
                data: { userId: user.userId, name: 'API_TOKEN', value: 'encrypted' },
            })
            await prisma.userMcpServer.create({
                data: {
                    userId: user.userId,
                    name: 'docs',
                    url: 'https://mcp.example.com',
                    encryptedHeaders: 'encrypted',
                },
            })

            const res = await authed(user.token).delete('/auth/account')

            expect(res.status).toBe(200)
            expect(queuedJobs).toEqual([
                {
                    name: 'sandbox_control',
                    data: {
                        taskType: 'sandbox_control',
                        action: 'stop',
                        sessionId: running.id,
                        sandboxId: 'sbx-account',
                    },
                },
            ])
            expect(await prisma.secret.count({ where: { userId: user.userId } })).toBe(0)
            expect(await prisma.userMcpServer.count({ where: { userId: user.userId } })).toBe(0)
            const saved = await prisma.user.findUnique({ where: { id: user.userId } })
            expect(saved?.isDeleted).toBe(true)
        })

        it('keeps the account when the sandbox stops cannot be queued', async () => {
            const user = await createSignedInUser({
                email: `delete-account-down-${stamp}@example.com`,
            })
            userIds.push(user.userId)
            await prisma.session.create({
                data: {
                    userId: user.userId,
                    title: 'running',
                    vmId: 'sbx-account-down',
                    sandboxStatus: 'RUNNING',
                },
            })
            await prisma.secret.create({
                data: { userId: user.userId, name: 'API_TOKEN', value: 'encrypted' },
            })

            failJobs()
            try {
                const res = await authed(user.token).delete('/auth/account')
                expect(res.status).toBe(503)
            } finally {
                recordJobs(queuedJobs)
            }

            const saved = await prisma.user.findUnique({ where: { id: user.userId } })
            expect(saved?.isDeleted).toBe(false)
            expect(await prisma.secret.count({ where: { userId: user.userId } })).toBe(1)
        })
    })

    describe('the 90-day purge', () => {
        const DAY = 24 * 60 * 60 * 1000

        beforeAll(async () => {
            await ensureStorageBucket()
        })

        const deletedUser = async (label: string, daysAgo: number) => {
            const user = await createSignedInUser({ email: `purge-${label}-${stamp}@example.com` })
            userIds.push(user.userId)
            await prisma.user.update({
                where: { id: user.userId },
                data: { isDeleted: true, deletedAt: new Date(Date.now() - daysAgo * DAY) },
            })
            return user
        }

        it('purges an account deleted more than 90 days ago and keeps its payments', async () => {
            const old = await deletedUser('old', 91)
            const session = await prisma.session.create({
                data: {
                    userId: old.userId,
                    title: 'old work',
                    messages: { create: [{ role: 'USER', content: 'hi', sequence: 1 }] },
                },
            })
            const payment = await prisma.walletTransaction.create({
                data: {
                    userId: old.userId,
                    amountInCents: 500,
                    provider: 'RAZORPAY',
                    providerOrderId: `order_purge_${stamp}`,
                    status: 'SUCCESS',
                },
            })
            await prisma.notification.create({
                data: { userId: old.userId, title: 'hello', message: 'hello', type: 'INFO' },
            })

            const result = await authService.purgeDeletedAccounts({})

            expect(result.purged).toBeGreaterThanOrEqual(1)
            expect(await prisma.user.findUnique({ where: { id: old.userId } })).toBeNull()
            expect(await prisma.session.findUnique({ where: { id: session.id } })).toBeNull()
            expect(await prisma.message.count({ where: { sessionId: session.id } })).toBe(0)
            expect(await prisma.notification.count({ where: { userId: old.userId } })).toBe(0)
            // the payment row stays for revenue and accounting, with no link to the person
            const kept = await prisma.walletTransaction.findUnique({ where: { id: payment.id } })
            expect(kept?.userId).toBeNull()
            expect(kept?.amountInCents).toBe(500)
            await prisma.walletTransaction.delete({ where: { id: payment.id } })
        })

        it('keeps an account deleted less than 90 days ago, and a live account', async () => {
            const recent = await deletedUser('recent', 89)
            const live = await createSignedInUser({ email: `purge-live-${stamp}@example.com` })
            userIds.push(live.userId)

            await authService.purgeDeletedAccounts({})

            expect(await prisma.user.findUnique({ where: { id: recent.userId } })).not.toBeNull()
            expect(await prisma.user.findUnique({ where: { id: live.userId } })).not.toBeNull()
        })

        it('the email of a purged account can sign up again', async () => {
            const email = `purge-again-${stamp}@example.com`
            const old = await createSignedInUser({ email })
            await prisma.user.update({
                where: { id: old.userId },
                data: { isDeleted: true, deletedAt: new Date(Date.now() - 91 * DAY) },
            })
            await authService.purgeDeletedAccounts({})

            const again = await createSignedInUser({ email })
            userIds.push(again.userId)
            expect(again.userId).not.toBe(old.userId)
        })
    })
})
