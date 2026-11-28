import { prisma } from '@december/database'
import { getRedisClient, setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { emailService } from '../../src/modules/email/email.service'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// #637 section 4: stop a session and keep its work, and the list of running sandboxes
describe('stop and running sandboxes', () => {
    const stamp = Date.now()
    const redis = getRedisClient()
    const savedPublish = redis.publish
    const savedSendMessage = emailService.sendMessageEmail
    const published: Array<{ channel: string; message: unknown }> = []
    const queued: Array<{ name: string; data: any }> = []

    let owner: { userId: string; token: string }
    let stranger: { userId: string; token: string }

    const as = (token: string) => ({
        get: (path: string) =>
            request(app)
                .get(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        post: (path: string) =>
            request(app)
                .post(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
    })

    /** a session whose agent works in a running sandbox */
    const workingSession = (title: string) =>
        prisma.session.create({
            data: {
                userId: owner.userId,
                title,
                vmId: `vm-${title}-${stamp}`,
                vmStatus: 'RUNNING',
                sandboxStatus: 'RUNNING',
                status: 'RUNNING',
                vmLastActivityAt: new Date(),
            },
        })

    beforeAll(async () => {
        // the worker is not there: what the server publishes and queues is kept here
        redis.publish = (async (channel: string, message: string) => {
            published.push({ channel, message: JSON.parse(message) })
            return 1
        }) as any
        setAgentQueue({
            add: async (name: string, data: any) => {
                queued.push({ name, data })
                return { id: `job-${queued.length}` }
            },
        } as any)
        emailService.sendMessageEmail = (async () => ({ id: 'email' })) as any

        owner = await createSignedInUser({ email: `session-stop-${stamp}@example.com` })
        stranger = await createSignedInUser({ email: `session-stop-other-${stamp}@example.com` })
    })

    afterAll(async () => {
        redis.publish = savedPublish
        setAgentQueue(null)
        emailService.sendMessageEmail = savedSendMessage
        const ids = [owner.userId, stranger.userId]
        await prisma.usageEvent.deleteMany({ where: { userId: { in: ids } } })
        await prisma.notification.deleteMany({ where: { userId: { in: ids } } })
        await prisma.session.deleteMany({ where: { userId: { in: ids } } })
        for (const id of ids) {
            await cleanupTestUser({ id })
        }
    })

    beforeEach(() => {
        published.length = 0
        queued.length = 0
    })

    const interrupts = () =>
        published.filter((sent) => sent.channel.startsWith('session_interrupts:'))

    describe('POST /session/:id/stop', () => {
        it("answers 404 for another user's session and stops nothing", async () => {
            const session = await workingSession('not-yours')

            const res = await as(stranger.token).post(`/session/${session.id}/stop`)

            expect(res.status).toBe(404)
            expect(interrupts()).toEqual([])
            expect(queued).toEqual([])
        })

        it('stops the run and sends the sandbox to pause, so the work stays', async () => {
            const session = await workingSession('busy')

            const res = await as(owner.token).post(`/session/${session.id}/stop`)

            expect(res.status).toBe(200)
            expect(interrupts()).toEqual([
                {
                    channel: `session_interrupts:${session.id}`,
                    message: { type: 'INTERRUPT', reason: 'user' },
                },
            ])
            expect(queued).toEqual([
                {
                    name: 'sandbox_control',
                    data: {
                        taskType: 'sandbox_control',
                        action: 'pause',
                        sessionId: session.id,
                        sandboxId: `vm-busy-${stamp}`,
                        // no run was queued or active for this session
                        afterStop: true,
                        stoppedRunId: null,
                    },
                },
            ])
            expect(res.body.data).toEqual({
                sessionId: session.id,
                vmStatus: 'STOPPED',
                sandboxStatus: 'PAUSED',
            })
            // the session is kept
            expect(await prisma.session.count({ where: { id: session.id } })).toBe(1)
        })

        it('a second call when nothing runs is fine and pauses nothing again', async () => {
            const session = await workingSession('twice')
            const first = await as(owner.token).post(`/session/${session.id}/stop`)
            expect(first.status).toBe(200)
            // what the worker saves when the run has ended and the sandbox is paused
            await prisma.session.update({
                where: { id: session.id },
                data: { vmStatus: 'STOPPED', sandboxStatus: 'PAUSED', status: 'PARKED' },
            })
            queued.length = 0

            const second = await as(owner.token).post(`/session/${session.id}/stop`)

            expect(second.status).toBe(200)
            expect(queued).toEqual([])
            expect(second.body.data).toEqual({
                sessionId: session.id,
                vmStatus: 'STOPPED',
                sandboxStatus: 'PAUSED',
            })
        })

        it('a session that never had a sandbox answers with its state', async () => {
            const session = await prisma.session.create({
                data: { userId: owner.userId, title: 'new' },
            })

            const res = await as(owner.token).post(`/session/${session.id}/stop`)

            expect(res.status).toBe(200)
            expect(queued).toEqual([])
            expect(res.body.data).toEqual({
                sessionId: session.id,
                vmStatus: 'STOPPED',
                sandboxStatus: null,
            })
        })

        it('a stopped session no longer waits for an answer', async () => {
            const session = await workingSession('asked')
            await prisma.session.update({
                where: { id: session.id },
                data: { pendingQuestionAt: new Date() },
            })

            await as(owner.token).post(`/session/${session.id}/stop`)

            const after = await prisma.session.findUnique({ where: { id: session.id } })
            expect(after?.pendingQuestionAt).toBe(null)
        })

        it('answers 400 for an id that is not a session id', async () => {
            const res = await as(owner.token).post('/session/not-an-id/stop')
            expect(res.status).toBe(400)
        })

        it('needs a signed in user and stops nothing without one', async () => {
            const session = await workingSession('no-token')

            const res = await request(app)
                .post(`/api/v1/session/${session.id}/stop`)
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(401)
            expect(interrupts()).toEqual([])
            expect(queued).toEqual([])
        })

        it('answers 404 for a session id that does not exist', async () => {
            const res = await as(owner.token).post(
                '/session/00000000-0000-4000-8000-000000000000/stop'
            )
            expect(res.status).toBe(404)
            expect(queued).toEqual([])
        })

        it('a sandbox that still starts: the run stops, and nothing is paused yet', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: owner.userId,
                    title: 'starting',
                    vmId: `vm-starting-${stamp}`,
                    vmStatus: 'PROVISIONING',
                    sandboxStatus: 'STARTING',
                },
            })

            const res = await as(owner.token).post(`/session/${session.id}/stop`)

            expect(res.status).toBe(200)
            expect(interrupts().map((sent) => sent.channel)).toEqual([
                `session_interrupts:${session.id}`,
            ])
            expect(queued).toEqual([])
            expect(res.body.data).toEqual({
                sessionId: session.id,
                vmStatus: 'STOPPED',
                sandboxStatus: 'STARTING',
            })
        })

        it('a running sandbox with no sandbox id queues no pause', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: owner.userId,
                    title: 'no vm id',
                    vmStatus: 'RUNNING',
                    sandboxStatus: 'RUNNING',
                },
            })

            const res = await as(owner.token).post(`/session/${session.id}/stop`)

            expect(res.status).toBe(200)
            expect(queued).toEqual([])
            expect(res.body.data.sandboxStatus).toBe('RUNNING')
        })

        it('answers 503 when the pause cannot be queued, and the sandbox is left as it is', async () => {
            const session = await workingSession('stop-no-queue')
            setAgentQueue({
                add: async () => {
                    throw new Error('redis is down')
                },
            } as any)
            try {
                const res = await as(owner.token).post(`/session/${session.id}/stop`)

                expect(res.status).toBe(503)
                expect(res.body.message).toBe('could not stop the session. try again')
                // nothing about the queue reaches the page
                expect(JSON.stringify(res.body)).not.toContain('redis')
                const after = await prisma.session.findUnique({ where: { id: session.id } })
                expect(after?.sandboxStatus).toBe('RUNNING')
            } finally {
                setAgentQueue({
                    add: async (name: string, data: any) => {
                        queued.push({ name, data })
                        return { id: `job-${queued.length}` }
                    },
                } as any)
            }
        })

        it('an archived session with a running sandbox can be stopped', async () => {
            const session = await workingSession('archived-running')
            await prisma.session.update({ where: { id: session.id }, data: { isArchived: true } })

            const res = await as(owner.token).post(`/session/${session.id}/stop`)

            expect(res.status).toBe(200)
            expect(queued.map((job) => job.data.sessionId)).toEqual([session.id])
        })

        it('is capped at 30 stops a minute for each user', async () => {
            const busy = await createSignedInUser({
                email: `session-stop-limit-${stamp}@example.com`,
            })
            try {
                const session = await prisma.session.create({
                    data: { userId: busy.userId, title: 'many stops' },
                })
                const statuses: number[] = []
                for (let i = 0; i < 31; i++) {
                    const res = await as(busy.token).post(`/session/${session.id}/stop`)
                    statuses.push(res.status)
                }
                expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true)
                expect(statuses[30]).toBe(429)
                // the cap is per user: another user is not slowed down
                const other = await workingSession('other-user-not-capped')
                const res = await as(owner.token).post(`/session/${other.id}/stop`)
                expect(res.status).toBe(200)
            } finally {
                await prisma.session.deleteMany({ where: { userId: busy.userId } })
                await cleanupTestUser({ id: busy.userId })
            }
        })
    })

    describe('GET /session/sandboxes', () => {
        it("lists the user's sessions with a running sandbox, with the cost on credits", async () => {
            await prisma.session.deleteMany({ where: { userId: owner.userId } })
            const running = await prisma.session.create({
                data: {
                    userId: owner.userId,
                    title: 'Fix the login page',
                    githubRepoOwner: 'acme',
                    githubRepoName: 'shop',
                    vmId: `vm-list-${stamp}`,
                    vmStatus: 'RUNNING',
                    sandboxStatus: 'RUNNING',
                    createdAt: new Date('2026-11-25T08:00:00Z'),
                },
            })
            const starting = await prisma.session.create({
                data: {
                    userId: owner.userId,
                    title: 'No repository',
                    vmStatus: 'PROVISIONING',
                    sandboxStatus: 'STARTING',
                    createdAt: new Date('2026-11-25T09:00:00Z'),
                },
            })
            // not in the list: paused, stopped, never started, another user's
            for (const sandboxStatus of ['PAUSED', 'STOPPED', null] as const) {
                await prisma.session.create({
                    data: { userId: owner.userId, title: `idle ${sandboxStatus}`, sandboxStatus },
                })
            }
            await prisma.session.create({
                data: { userId: stranger.userId, title: 'theirs', sandboxStatus: 'RUNNING' },
            })
            const usage = (costInCents: number, billingSource: 'CREDITS' | 'OWN_KEY') =>
                prisma.usageEvent.create({
                    data: {
                        userId: owner.userId,
                        sessionId: running.id,
                        model: 'test-model',
                        costInCents,
                        billingSource,
                        periodStart: new Date('2026-11-01T00:00:00Z'),
                        periodEnd: new Date('2026-12-01T00:00:00Z'),
                    },
                })
            await usage(12.5, 'CREDITS')
            await usage(30, 'CREDITS')
            // paid by the user's own key: not a cost on december credits
            await usage(99, 'OWN_KEY')

            const res = await as(owner.token).get('/session/sandboxes')

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                items: [
                    {
                        sessionId: starting.id,
                        title: 'No repository',
                        repoFullName: null,
                        startedAt: '2026-11-25T09:00:00.000Z',
                        costInCents: 0,
                        sandboxStatus: 'STARTING',
                    },
                    {
                        sessionId: running.id,
                        title: 'Fix the login page',
                        repoFullName: 'acme/shop',
                        startedAt: '2026-11-25T08:00:00.000Z',
                        costInCents: 42.5,
                        sandboxStatus: 'RUNNING',
                    },
                ],
            })
        })

        it('needs a signed in user', async () => {
            const res = await request(app)
                .get('/api/v1/session/sandboxes')
                .set('x-forwarded-for', getRandomIP())
            expect(res.status).toBe(401)
        })

        it('leaves out a start that is left over from a crashed worker', async () => {
            await prisma.session.deleteMany({ where: { userId: owner.userId } })
            const fresh = await prisma.session.create({
                data: { userId: owner.userId, title: 'fresh start', sandboxStatus: 'STARTING' },
            })
            const stale = await prisma.session.create({
                data: { userId: owner.userId, title: 'stale start', sandboxStatus: 'STARTING' },
            })
            // a running sandbox that was last changed long ago still runs
            const oldRunning = await prisma.session.create({
                data: { userId: owner.userId, title: 'old running', sandboxStatus: 'RUNNING' },
            })
            const longAgo = new Date(Date.now() - 16 * 60 * 1000)
            await prisma.$executeRaw`UPDATE "Session" SET "updatedAt" = ${longAgo} WHERE "id" IN (${stale.id}, ${oldRunning.id})`

            const res = await as(owner.token).get('/session/sandboxes')

            expect(res.status).toBe(200)
            const ids = res.body.data.items.map((item: { sessionId: string }) => item.sessionId)
            expect(ids).toContain(fresh.id)
            expect(ids).toContain(oldRunning.id)
            expect(ids).not.toContain(stale.id)
        })

        it('uses the time the sandbox last started, and lists archived sessions too', async () => {
            await prisma.session.deleteMany({ where: { userId: owner.userId } })
            const resumed = await prisma.session.create({
                data: {
                    userId: owner.userId,
                    title: 'resumed',
                    sandboxStatus: 'RUNNING',
                    isArchived: true,
                    createdAt: new Date('2026-11-20T08:00:00Z'),
                    sandboxStartedAt: new Date('2026-11-25T12:30:00Z'),
                },
            })

            const res = await as(owner.token).get('/session/sandboxes')

            expect(res.body.data.items).toEqual([
                {
                    sessionId: resumed.id,
                    title: 'resumed',
                    repoFullName: null,
                    startedAt: '2026-11-25T12:30:00.000Z',
                    costInCents: 0,
                    sandboxStatus: 'RUNNING',
                },
            ])
        })

        it("never lists or counts another user's sandbox", async () => {
            await prisma.session.deleteMany({
                where: { userId: { in: [owner.userId, stranger.userId] } },
            })
            const theirs = await prisma.session.create({
                data: { userId: stranger.userId, title: 'theirs', sandboxStatus: 'RUNNING' },
            })
            await prisma.usageEvent.create({
                data: {
                    userId: stranger.userId,
                    sessionId: theirs.id,
                    model: 'test-model',
                    costInCents: 500,
                    billingSource: 'CREDITS',
                    periodStart: new Date('2026-11-01T00:00:00Z'),
                    periodEnd: new Date('2026-12-01T00:00:00Z'),
                },
            })

            const mine = await as(owner.token).get('/session/sandboxes')
            const list = await as(stranger.token).get('/session/sandboxes')

            expect(mine.body.data).toEqual({ items: [] })
            expect(list.body.data.items.map((item: any) => item.costInCents)).toEqual([500])
        })

        it('is empty for a user with no running sandbox', async () => {
            await prisma.session.deleteMany({ where: { userId: stranger.userId } })
            const res = await as(stranger.token).get('/session/sandboxes')
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ items: [] })
        })
    })

    // the events the worker sends at the end of a run, as socket.ts hands them over
    describe('the end of a run and the "finished" notification', () => {
        const newSession = async () =>
            (await prisma.session.create({ data: { userId: owner.userId, title: 'Run events' } }))
                .id
        const inboxTitles = async () =>
            (
                await prisma.notification.findMany({
                    where: { userId: owner.userId },
                    orderBy: { createdAt: 'asc' },
                })
            ).map((row) => row.title)

        beforeEach(async () => {
            await prisma.notification.deleteMany({ where: { userId: owner.userId } })
            // "finished" goes out only on the "everything" level
            await prisma.user.update({
                where: { id: owner.userId },
                data: { notifyLevel: 'ALL' },
            })
        })

        it('a failed run, then a rerun that finishes at once: the rerun is "finished"', async () => {
            const id = await newSession()
            // a run with no credits: the worker sends the error, then the end of the run
            await sessionService.handleRunEvent({
                sessionId: id,
                event: { type: 'AgentError', error: 'Insufficient wallet credits' },
            })
            await sessionService.handleRunEvent({
                sessionId: id,
                event: { type: 'AgentEnd', failed: true },
            })
            // the user adds credits and sends the prompt again
            await sessionService.handleRunEvent({ sessionId: id, event: { type: 'AgentEnd' } })

            expect(await inboxTitles()).toEqual(['A session failed', 'A session finished'])
        })

        it('a stopped run is not "finished", and the run after it is', async () => {
            const id = await newSession()
            await sessionService.handleRunEvent({
                sessionId: id,
                event: { type: 'AgentEnd', stopped: true, reason: 'user' },
            })
            expect(await inboxTitles()).toEqual([])

            await sessionService.handleRunEvent({ sessionId: id, event: { type: 'AgentEnd' } })
            expect(await inboxTitles()).toEqual(['A session finished'])
        })
    })
    // deleting one session must not leave its run or its sandbox going (E2B bills it)
    describe('DELETE /session/:id', () => {
        const del = (token: string, id: string) =>
            request(app)
                .delete(`/api/v1/session/${id}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)

        it('stops the run and the live sandbox, then deletes the session', async () => {
            const session = await workingSession('delete-live')

            const res = await del(owner.token, session.id)

            expect(res.status).toBe(200)
            expect(queued).toEqual([
                {
                    name: 'sandbox_control',
                    data: {
                        taskType: 'sandbox_control',
                        action: 'stop',
                        sessionId: session.id,
                        sandboxId: `vm-delete-live-${stamp}`,
                    },
                },
            ])
            expect(interrupts()).toEqual([
                {
                    channel: `session_interrupts:${session.id}`,
                    message: { type: 'INTERRUPT', reason: 'user' },
                },
            ])
            expect(await prisma.session.count({ where: { id: session.id } })).toBe(0)
        })

        it('queues no stop for a sandbox that is already stopped', async () => {
            const session = await workingSession('delete-stopped')
            await prisma.session.update({
                where: { id: session.id },
                data: { sandboxStatus: 'STOPPED', vmStatus: 'STOPPED' },
            })

            const res = await del(owner.token, session.id)

            expect(res.status).toBe(200)
            expect(queued).toEqual([])
            expect(await prisma.session.count({ where: { id: session.id } })).toBe(0)
        })

        it('deletes nothing when the sandbox stop cannot be queued', async () => {
            const session = await workingSession('delete-no-queue')
            setAgentQueue({
                add: async () => {
                    throw new Error('redis is down')
                },
            } as any)
            try {
                const res = await del(owner.token, session.id)
                expect(res.status).toBe(503)
                expect(await prisma.session.count({ where: { id: session.id } })).toBe(1)
            } finally {
                setAgentQueue({
                    add: async (name: string, data: any) => {
                        queued.push({ name, data })
                        return { id: `job-${queued.length}` }
                    },
                } as any)
            }
        })

        it("answers 404 for another user's session and stops nothing", async () => {
            const session = await workingSession('delete-not-yours')

            const res = await del(stranger.token, session.id)

            expect(res.status).toBe(404)
            expect(queued).toEqual([])
            expect(interrupts()).toEqual([])
            expect(await prisma.session.count({ where: { id: session.id } })).toBe(1)
        })
    })
})
