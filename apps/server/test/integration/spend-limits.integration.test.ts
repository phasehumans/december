import { prisma } from '@december/database'
import { getRedisClient, setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { emailService } from '../../src/modules/email/email.service'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// #638 section 1: a session pauses at the session limit and at the day limit, and asks
describe('spend limits: pause and ask', () => {
    const stamp = Date.now()
    const redis = getRedisClient()
    const savedPublish = redis.publish
    const savedSendMessage = emailService.sendMessageEmail
    const published: Array<{ channel: string; message: any }> = []
    const queued: Array<{ name: string; data: any }> = []
    const emails: Array<{ to: string; subject: string; body: string }> = []
    const userIds: string[] = []
    let count = 0

    type TestUser = { userId: string; token: string; email: string }

    const as = (token: string) => ({
        get: (path: string) =>
            request(app)
                .get(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        post: (path: string, body: object = {}) =>
            request(app)
                .post(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send(body),
    })

    /** a user with limits in cents */
    const userWith = async (limits: {
        sessionLimitCents?: number
        dayLimitCents?: number
    }): Promise<TestUser> => {
        count += 1
        const email = `spend-limits-${count}-${stamp}@example.com`
        const user = await createSignedInUser({ email })
        userIds.push(user.userId)
        await prisma.user.update({
            where: { id: user.userId },
            data: { ...limits, creditBalance: 5000 },
        })
        return { ...user, email }
    }
    /** a session whose agent works */
    const workingSession = (user: TestUser, title: string) =>
        prisma.session.create({
            data: {
                userId: user.userId,
                title,
                vmId: `vm-${title}-${stamp}`,
                vmStatus: 'RUNNING',
                sandboxStatus: 'RUNNING',
                status: 'RUNNING',
            },
        })
    /** what the worker saves for one model call of a run */
    const charge = (
        user: TestUser,
        sessionId: string,
        costInCents: number,
        options: { billingSource?: 'CREDITS' | 'OWN_KEY'; createdAt?: Date } = {}
    ) =>
        prisma.usageEvent.create({
            data: {
                userId: user.userId,
                sessionId,
                model: 'test-model',
                costInCents,
                billingSource: options.billingSource ?? 'CREDITS',
                periodStart: new Date('2026-11-01T00:00:00Z'),
                periodEnd: new Date('2026-12-01T00:00:00Z'),
                ...(options.createdAt ? { createdAt: options.createdAt } : {}),
            },
        })
    /** the event of the worker's charge check, as socket.ts hands it over */
    const limitReached = (sessionId: string, kind: 'session' | 'day' = 'session') =>
        sessionService.handleRunEvent({ sessionId, event: { type: 'SpendLimitReached', kind } })
    const answer = (user: TestUser, sessionId: string, text: string) =>
        as(user.token).post(`/session/${sessionId}/question-answer`, {
            questionId: 'spend-limit:session',
            answer: text,
        })
    const sessionRow = (id: string) => prisma.session.findUniqueOrThrow({ where: { id } })
    const interrupts = () =>
        published.filter((sent) => sent.channel.startsWith('session_interrupts:'))
    const inboxTitles = async (user: TestUser) =>
        (
            await prisma.notification.findMany({
                where: { userId: user.userId },
                orderBy: { createdAt: 'asc' },
            })
        ).map((row) => row.title)

    beforeAll(() => {
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
        emailService.sendMessageEmail = (async (data: {
            to: string
            subject: string
            body: string
        }) => {
            emails.push(data)
            return { id: `email-${emails.length}` }
        }) as any
    })

    afterAll(async () => {
        redis.publish = savedPublish
        setAgentQueue(null)
        emailService.sendMessageEmail = savedSendMessage
        await prisma.usageEvent.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    beforeEach(() => {
        published.length = 0
        queued.length = 0
    })

    describe('the session limit', () => {
        it('does nothing while the cost of the session is under the amount', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await workingSession(user, 'under')
            await charge(user, session.id, 499)

            await limitReached(session.id)

            expect(interrupts()).toEqual([])
            expect((await sessionRow(session.id)).pendingQuestionAt).toBe(null)
            expect(await inboxTitles(user)).toEqual([])
        })

        it('stops the run with reason limit, saves the question and asks', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await workingSession(user, 'reached')
            await charge(user, session.id, 300)
            await charge(user, session.id, 250)

            await limitReached(session.id)
            // every server node gets the event: the second one changes nothing
            await limitReached(session.id)

            expect(interrupts()).toEqual([
                {
                    channel: `session_interrupts:${session.id}`,
                    message: { type: 'INTERRUPT', reason: 'limit' },
                },
            ])
            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe('session')
            expect(row.pendingQuestionAt).not.toBe(null)

            // the session shows the question with its two choices
            const pending = await as(user.token).get(`/session/${session.id}/pending-question`)
            expect(pending.status).toBe(200)
            expect(pending.body.data.questions).toEqual([
                { question: 'Reached $5. Continue?', options: ['Continue', 'Stop here'] },
            ])
            // the inbox and the mail ask too, once
            expect(await inboxTitles(user)).toEqual(['Reached $5. Continue?'])
            expect(
                emails.filter((sent) => sent.to === user.email).map((sent) => sent.subject)
            ).toEqual(['Reached $5. Continue? "reached"'])
            // the list marks the session as "needs answer"
            const list = await as(user.token).get('/session?needsAnswer=true')
            expect(list.body.data.sessions.map((item: { id: string }) => item.id)).toEqual([
                session.id,
            ])
        })

        it('the end of the run and a late QuestionSettled keep the question', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await workingSession(user, 'kept')
            await charge(user, session.id, 500)
            await limitReached(session.id)

            await sessionService.handleRunEvent({
                sessionId: session.id,
                event: { type: 'AgentEnd', stopped: true, reason: 'limit' },
            })
            await sessionService.markQuestionSettled({ sessionId: session.id })

            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe('session')
            expect(row.pendingQuestionAt).not.toBe(null)
            // a stopped run is not a "finished" one
            expect(await inboxTitles(user)).toEqual(['Reached $5. Continue?'])
        })

        it('"Continue" lets the session run for the same amount again and queues the run', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await workingSession(user, 'continue')
            await charge(user, session.id, 550)
            await limitReached(session.id)

            const res = await answer(user, session.id, 'Continue')
            // the web sends the answer twice (socket and http): one run
            await answer(user, session.id, 'Continue')

            expect(res.status).toBe(200)
            expect(res.body.data.continued).toBe(true)
            const runs = queued.filter((job) => job.name === 'run_agent')
            expect(runs).toHaveLength(1)
            expect(runs[0]?.data).toMatchObject({
                sessionId: session.id,
                userId: user.userId,
                prompt: 'Continue',
                billingSource: 'CREDITS',
                planFirst: false,
            })
            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe(null)
            expect(row.pendingQuestionAt).toBe(null)
            // $5.50 is let through: the next pause is at $10.50
            expect(row.limitAllowanceCents).toBe(550)
            const messages = await prisma.message.findMany({ where: { sessionId: session.id } })
            expect(messages.map((message) => [message.role, message.content])).toEqual([
                ['USER', 'Continue'],
            ])

            published.length = 0
            await charge(user, session.id, 499)
            await limitReached(session.id)
            expect(interrupts()).toEqual([])

            await charge(user, session.id, 1)
            await limitReached(session.id)
            expect(interrupts()).toHaveLength(1)
            expect((await sessionRow(session.id)).limitQuestionKind).toBe('session')
        })

        it('"Stop here" leaves the session parked with its work', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await workingSession(user, 'stop-here')
            await charge(user, session.id, 500)
            await limitReached(session.id)

            const res = await answer(user, session.id, 'Stop here')

            expect(res.status).toBe(200)
            expect(res.body.data.continued).toBe(false)
            expect(queued).toEqual([])
            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe(null)
            expect(row.pendingQuestionAt).toBe(null)
            expect(row.limitAllowanceCents).toBe(0)
            expect(
                (await as(user.token).get(`/session/${session.id}/pending-question`)).body.data
            ).toBe(null)
        })

        it('the stop button answers the question with "stop here"', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await workingSession(user, 'stop-button')
            await charge(user, session.id, 500)
            await limitReached(session.id)

            await as(user.token).post(`/session/${session.id}/stop`)

            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe(null)
            expect(row.pendingQuestionAt).toBe(null)
            expect(queued.filter((job) => job.name === 'run_agent')).toEqual([])
        })

        it('another user cannot answer the question', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const stranger = await userWith({})
            const session = await workingSession(user, 'not-yours')
            await charge(user, session.id, 500)
            await limitReached(session.id)

            const res = await answer(stranger, session.id, 'Continue')

            expect(res.status).toBe(404)
            expect(queued).toEqual([])
            expect((await sessionRow(session.id)).limitQuestionKind).toBe('session')
        })

        it('cost on the own key of the user does not count', async () => {
            const user = await userWith({ sessionLimitCents: 500, dayLimitCents: 500 })
            const session = await workingSession(user, 'own-key')
            await charge(user, session.id, 9000, { billingSource: 'OWN_KEY' })
            await charge(user, session.id, 100)

            await limitReached(session.id)

            expect(interrupts()).toEqual([])
            expect((await sessionRow(session.id)).limitQuestionKind).toBe(null)
        })

        it('a new prompt while the question is open counts as "Continue"', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await workingSession(user, 'new-prompt')
            await charge(user, session.id, 520)
            await limitReached(session.id)

            // what the socket does before it queues the run of a new prompt
            await sessionService.promptAtLimit({
                userId: user.userId,
                sessionId: session.id,
                billingSource: 'CREDITS',
            })

            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe(null)
            expect(row.pendingQuestionAt).toBe(null)
            expect(row.limitAllowanceCents).toBe(520)
            // the prompt itself is the run: no "Continue" run is added
            expect(queued).toEqual([])
        })

        it('"Continue" starts a run that was held before it started, as it was sent', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await workingSession(user, 'held')
            await charge(user, session.id, 500)
            // the worker held the run at its start and saved it without the secrets
            await prisma.session.update({
                where: { id: session.id },
                data: {
                    limitHeldRun: {
                        sessionId: session.id,
                        userId: user.userId,
                        prompt: 'add a dark mode',
                        billingSource: 'CREDITS',
                        skills: ['design'],
                        userMessageSequence: 4,
                    },
                },
            })
            await limitReached(session.id)

            await answer(user, session.id, 'Continue')

            const runs = queued.filter((job) => job.name === 'run_agent')
            expect(runs).toHaveLength(1)
            expect(runs[0]?.data).toMatchObject({
                sessionId: session.id,
                userId: user.userId,
                prompt: 'add a dark mode',
                skills: ['design'],
                userMessageSequence: 4,
                secrets: [],
            })
            expect((await sessionRow(session.id)).limitHeldRun).toBe(null)
        })
    })

    describe('the day limit', () => {
        it('pauses each session of the user, and one "Continue" covers the day', async () => {
            const user = await userWith({ dayLimitCents: 2000 })
            const first = await workingSession(user, 'day-one')
            const second = await workingSession(user, 'day-two')
            // two days ago: not in the total of today
            await charge(user, first.id, 5000, {
                createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            })
            await charge(user, first.id, 1500)
            await limitReached(first.id, 'day')
            expect(interrupts()).toEqual([])

            await charge(user, second.id, 600)
            // each run sees the total at its next charge
            await limitReached(second.id, 'day')
            await limitReached(first.id, 'day')

            expect(interrupts().map((sent) => [sent.channel, sent.message.reason])).toEqual([
                [`session_interrupts:${second.id}`, 'limit'],
                [`session_interrupts:${first.id}`, 'limit'],
            ])
            expect((await sessionRow(first.id)).limitQuestionKind).toBe('day')
            expect((await sessionRow(second.id)).limitQuestionKind).toBe('day')
            const pending = await as(user.token).get(`/session/${first.id}/pending-question`)
            expect(pending.body.data.questions).toEqual([
                { question: 'Reached $20 today. Continue?', options: ['Continue', 'Stop here'] },
            ])
            expect(await inboxTitles(user)).toEqual([
                'Reached $20 today. Continue?',
                'Reached $20 today. Continue?',
            ])

            // "Continue" in the first session: the $21 of today is let through
            await answer(user, first.id, 'Continue')
            const afterFirst = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })
            expect(afterFirst.dayLimitAllowanceCents).toBe(2100)

            // "Continue" in the second session starts its run and adds no second amount
            await charge(user, second.id, 50)
            await answer(user, second.id, 'Continue')
            const afterSecond = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })
            expect(afterSecond.dayLimitAllowanceCents).toBe(2100)
            expect(
                queued.filter((job) => job.name === 'run_agent').map((job) => job.data.sessionId)
            ).toEqual([first.id, second.id])

            // the same amount again: the next pause is at $41 for the day
            published.length = 0
            await charge(user, first.id, 1949)
            await limitReached(first.id, 'day')
            expect(interrupts()).toEqual([])
            await charge(user, second.id, 1)
            await limitReached(second.id, 'day')
            expect(interrupts()).toHaveLength(1)
        })

        it('the next day starts fresh', async () => {
            const user = await userWith({ dayLimitCents: 2000 })
            const session = await workingSession(user, 'next-day')
            // yesterday the user continued past $30
            await prisma.user.update({
                where: { id: user.userId },
                data: { dayLimitAllowanceDay: '2020-01-01', dayLimitAllowanceCents: 3000 },
            })
            await charge(user, session.id, 2000)

            await limitReached(session.id, 'day')

            expect(interrupts()).toHaveLength(1)
            expect((await sessionRow(session.id)).limitQuestionKind).toBe('day')
        })
    })
})
