import { prisma } from '@december/database'
import { runMarkKey, stopRequestKey } from '@december/shared'
import { getRedisClient, setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { emailService } from '../../src/modules/email/email.service'
import { sessionService } from '../../src/modules/session/session.service'
import { isLimitQuestionId, mergeHeldRun } from '../../src/modules/session/session.utils'
import { isBlankPrompt } from '../../src/socket'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// the life of a run: one run for a session, a stop that is not lost, the spend limit question
describe('the life of a run', () => {
    const stamp = Date.now()
    const queueRedis = getRedisClient()
    const savedPublish = queueRedis.publish
    const savedSendMessage = emailService.sendMessageEmail
    // reads what the server left in redis for the worker
    const redis = new Redis(env.REDIS_URL || 'redis://localhost:6379')
    const published: Array<{ channel: string; message: any }> = []
    const queued: Array<{ name: string; data: any }> = []
    const userIds: string[] = []
    const sessionIds: string[] = []
    let failQueue = false
    let count = 0

    type TestUser = { userId: string; token: string }

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

    const userWith = async (data: object = {}): Promise<TestUser> => {
        count += 1
        const user = await createSignedInUser({ email: `run-life-${count}-${stamp}@example.com` })
        userIds.push(user.userId)
        await prisma.user.update({
            where: { id: user.userId },
            data: { creditBalance: 5000, ...data },
        })
        return user
    }
    const newSession = async (user: TestUser, title: string, data: object = {}) => {
        const session = await prisma.session.create({
            data: {
                userId: user.userId,
                title,
                vmId: `vm-${title}-${stamp}`,
                vmStatus: 'RUNNING',
                sandboxStatus: 'RUNNING',
                status: 'RUNNING',
                ...data,
            },
        })
        sessionIds.push(session.id)
        return session
    }
    const charge = (user: TestUser, sessionId: string, costInCents: number) =>
        prisma.usageEvent.create({
            data: {
                userId: user.userId,
                sessionId,
                model: 'test-model',
                costInCents,
                billingSource: 'CREDITS',
                periodStart: new Date('2026-11-01T00:00:00Z'),
                periodEnd: new Date('2026-12-01T00:00:00Z'),
            },
        })
    const limitReached = (sessionId: string) =>
        sessionService.handleRunEvent({
            sessionId,
            event: { type: 'SpendLimitReached', kind: 'session' },
        })
    const answer = (user: TestUser, sessionId: string, text: string, questionId?: string) =>
        as(user.token).post(`/session/${sessionId}/question-answer`, {
            questionId: questionId ?? 'spend-limit:session',
            answer: text,
        })
    const sessionRow = (id: string) => prisma.session.findUniqueOrThrow({ where: { id } })
    const runs = () => queued.filter((job) => job.name === 'run_agent')
    const heldRun = (user: TestUser, sessionId: string) => ({
        sessionId,
        userId: user.userId,
        prompt: 'add a dark mode',
        billingSource: 'CREDITS',
        skills: ['design'],
        attachments: [{ id: 'file-1', name: 'mock.png' }],
        userMessageSequence: 4,
        runId: 'the-run-that-was-held',
    })

    beforeAll(() => {
        queueRedis.publish = (async (channel: string, message: string) => {
            published.push({ channel, message: JSON.parse(message) })
            return 1
        }) as any
        setAgentQueue({
            add: async (name: string, data: any) => {
                if (failQueue) throw new Error('the queue is down')
                queued.push({ name, data })
                return { id: `job-${queued.length}` }
            },
        } as any)
        emailService.sendMessageEmail = (async () => ({ id: 'email' })) as any
    })

    afterAll(async () => {
        queueRedis.publish = savedPublish
        setAgentQueue(null)
        emailService.sendMessageEmail = savedSendMessage
        for (const sessionId of sessionIds) {
            await redis.del(runMarkKey(sessionId), stopRequestKey(sessionId))
        }
        await redis.quit()
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
        failQueue = false
    })

    describe('a stop is not lost while the run waits in the queue', () => {
        it('leaves a stop request for the queued run, and the pause names that run', async () => {
            const user = await userWith()
            const session = await newSession(user, 'queued-stop')
            const routed = await sessionService.routePrompt({
                userId: user.userId,
                sessionId: session.id,
            })
            expect(routed.route).toBe('run')

            const res = await as(user.token).post(`/session/${session.id}/stop`)

            expect(res.status).toBe(200)
            // the job reads this when it starts: no worker listens for a queued run yet
            expect(await redis.get(stopRequestKey(session.id))).toBe(`user:${routed.runId}`)
            expect(queued).toEqual([
                {
                    name: 'sandbox_control',
                    data: {
                        taskType: 'sandbox_control',
                        action: 'pause',
                        sessionId: session.id,
                        sandboxId: `vm-queued-stop-${stamp}`,
                        // the worker leaves the sandbox when another run holds the session
                        afterStop: true,
                        stoppedRunId: routed.runId,
                    },
                },
            ])
        })

        it('leaves no stop request for a session with no run: the next run is not stopped', async () => {
            const user = await userWith()
            const session = await newSession(user, 'idle-stop')

            await as(user.token).post(`/session/${session.id}/stop`)

            expect(await redis.exists(stopRequestKey(session.id))).toBe(0)
            expect(queued[0]?.data).toMatchObject({ afterStop: true, stoppedRunId: null })
        })

        it('a stop by a spend limit is kept for the run too', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'limit-stop')
            const routed = await sessionService.routePrompt({
                userId: user.userId,
                sessionId: session.id,
            })
            await charge(user, session.id, 500)

            await limitReached(session.id)

            expect(await redis.get(stopRequestKey(session.id))).toBe(`limit:${routed.runId}`)
        })
    })

    describe('one run for a session, on every path', () => {
        it('a claimed run has an id, and only that run frees the session', async () => {
            const user = await userWith()
            const session = await newSession(user, 'owner')
            const first = await sessionService.routePrompt({
                userId: user.userId,
                sessionId: session.id,
            })
            expect(typeof first.runId).toBe('string')
            expect(await redis.get(runMarkKey(session.id))).toBe(first.runId)

            // the end of another run does not free the session
            await sessionService.releaseRun({ sessionId: session.id, runId: 'another-run' })
            expect(
                await sessionService.routePrompt({ userId: user.userId, sessionId: session.id })
            ).toEqual({ route: 'queued', runId: null })

            await sessionService.releaseRun({ sessionId: session.id, runId: first.runId! })
            expect(
                (await sessionService.routePrompt({ userId: user.userId, sessionId: session.id }))
                    .route
            ).toBe('run')
        })

        it('"Continue" at a limit claims the session for its run', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'continue-claims')
            await charge(user, session.id, 500)
            await limitReached(session.id)

            const res = await answer(user, session.id, 'Continue')

            expect(res.status).toBe(200)
            expect(runs()).toHaveLength(1)
            const runId = runs()[0]?.data.runId
            expect(typeof runId).toBe('string')
            expect(await redis.get(runMarkKey(session.id))).toBe(runId)
            // a prompt sent while that run waits starts no second run
            expect(
                await sessionService.routePrompt({ userId: user.userId, sessionId: session.id })
            ).toEqual({ route: 'queued', runId: null })
        })

        it('a held run that continues gets the id of the new claim', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'held-claims')
            await charge(user, session.id, 500)
            await prisma.session.update({
                where: { id: session.id },
                data: { limitHeldRun: heldRun(user, session.id) },
            })
            await limitReached(session.id)

            await answer(user, session.id, 'Continue')

            const runId = runs()[0]?.data.runId
            expect(runId).not.toBe('the-run-that-was-held')
            expect(await redis.get(runMarkKey(session.id))).toBe(runId)
            expect(runs()[0]?.data.prompt).toBe('add a dark mode')
        })

        it('"Continue" while a run still holds the session starts no second run and keeps the question', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'continue-busy')
            await charge(user, session.id, 500)
            await prisma.session.update({
                where: { id: session.id },
                data: { limitHeldRun: heldRun(user, session.id) },
            })
            await limitReached(session.id)
            // the stopped run has not ended yet
            await sessionService.routePrompt({ userId: user.userId, sessionId: session.id })

            const res = await answer(user, session.id, 'Continue')

            expect(res.status).toBe(409)
            expect(runs()).toEqual([])
            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe('session')
            expect(row.limitQuestionCents).toBe(500)
            expect((row.limitHeldRun as any)?.prompt).toBe('add a dark mode')
            expect(row.pendingQuestionAt).not.toBe(null)
        })
    })

    describe('the spend limit question', () => {
        it('a "Continue" that cannot queue the run keeps the question and the held prompt', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'queue-fails')
            await charge(user, session.id, 500)
            await prisma.session.update({
                where: { id: session.id },
                data: { limitHeldRun: heldRun(user, session.id) },
            })
            await limitReached(session.id)
            failQueue = true

            const res = await answer(user, session.id, 'Continue')

            expect(res.status).toBeGreaterThanOrEqual(500)
            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe('session')
            expect((row.limitHeldRun as any)?.prompt).toBe('add a dark mode')
            // the session is free: the next "Continue" can claim it
            expect(await redis.exists(runMarkKey(session.id))).toBe(0)

            failQueue = false
            const again = await answer(user, session.id, 'Continue')
            expect(again.status).toBe(200)
            expect(runs()).toHaveLength(1)
            expect(runs()[0]?.data.prompt).toBe('add a dark mode')
        })

        it('a limit event that asks nothing clears a held run that is left over', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'stale-held')
            // under the limit: the worker held the run, but the server does not ask
            await charge(user, session.id, 100)
            await prisma.session.update({
                where: { id: session.id },
                data: { limitHeldRun: heldRun(user, session.id) },
            })

            await limitReached(session.id)

            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe(null)
            expect(row.limitHeldRun).toBe(null)
        })

        it('a limit event for a question that is already open keeps its held run', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'open-held')
            await charge(user, session.id, 500)
            await prisma.session.update({
                where: { id: session.id },
                data: { limitHeldRun: heldRun(user, session.id) },
            })
            await limitReached(session.id)

            await limitReached(session.id)

            expect(((await sessionRow(session.id)).limitHeldRun as any)?.prompt).toBe(
                'add a dark mode'
            )
        })

        it('a new prompt while a held prompt waits takes the files and skills of the held prompt', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'held-new-prompt')
            await charge(user, session.id, 500)
            await prisma.session.update({
                where: { id: session.id },
                data: { limitHeldRun: heldRun(user, session.id) },
            })
            await limitReached(session.id)

            const result = await sessionService.promptAtLimit({
                userId: user.userId,
                sessionId: session.id,
                billingSource: 'CREDITS',
            })

            expect(result.continued).toBe(true)
            expect(result.heldRun).toEqual({
                attachments: [{ id: 'file-1', name: 'mock.png' }],
                skills: ['design'],
            })
            expect((await sessionRow(session.id)).limitQuestionKind).toBe(null)
        })

        it('adds the held files and skills to the run of the new prompt, once', () => {
            expect(
                mergeHeldRun({
                    heldRun: { attachments: [{ id: 'a' }], skills: ['design', 'review'] },
                    attachments: [{ id: 'b' }],
                    skills: ['review', 'test'],
                })
            ).toEqual({
                attachments: [{ id: 'a' }, { id: 'b' }],
                skills: ['design', 'review', 'test'],
            })
            expect(mergeHeldRun({ heldRun: null, attachments: [], skills: ['test'] })).toEqual({
                attachments: [],
                skills: ['test'],
            })
        })

        it('an answer to another question card is not an answer to the limit question', async () => {
            const user = await userWith({ sessionLimitCents: 500 })
            const session = await newSession(user, 'other-card')
            await charge(user, session.id, 500)
            await limitReached(session.id)

            // the socket path
            const viaSocket = await sessionService.answerLimitQuestion({
                userId: user.userId,
                sessionId: session.id,
                questionId: 'ask-question-7',
                answer: 'Use postgres',
            })
            // the http path
            const viaHttp = await answer(user, session.id, 'Use postgres', 'ask-question-7')

            expect(viaSocket.handled).toBe(false)
            expect(viaHttp.status).toBe(200)
            expect(viaHttp.body.data.questionId).toBe('ask-question-7')
            const row = await sessionRow(session.id)
            expect(row.limitQuestionKind).toBe('session')
            expect(row.pendingQuestionAt).not.toBe(null)
            expect(runs()).toEqual([])
        })

        it('knows the id of a limit question', () => {
            expect(isLimitQuestionId('spend-limit:session')).toBe(true)
            expect(isLimitQuestionId('spend-limit:day')).toBe(true)
            // a client from before question ids
            expect(isLimitQuestionId(undefined)).toBe(true)
            expect(isLimitQuestionId('ask-question-7')).toBe(false)
        })
    })

    describe('a prompt with no model on the own key of the user', () => {
        const ownKeyUser = async () => {
            const user = await userWith()
            await prisma.providerCredential.create({
                data: {
                    userId: user.userId,
                    provider: 'groq',
                    encryptedKey: 'not-a-real-key',
                    keyHint: 'wxyz',
                    models: ['llama-3.3-70b-versatile', 'qwen-qwq-32b'],
                    defaultModel: 'llama-3.3-70b-versatile',
                    verifiedAt: new Date(),
                },
            })
            return user
        }
        const savedModel = (sessionId: string, model: string) =>
            prisma.sessionSettings.create({
                data: { sessionId, config: { provider: 'groq', model } },
            })

        it('runs on the model saved for the session, not on the default of the key', async () => {
            const user = await ownKeyUser()
            const session = await newSession(user, 'own-key-saved')
            await savedModel(session.id, 'qwen-qwq-32b')

            const ownKey = await sessionService.resolveOwnKeyTurnModel({
                userId: user.userId,
                sessionId: session.id,
                provider: 'groq',
            })
            expect(ownKey).toEqual({ provider: 'groq', model: 'qwen-qwq-32b' })

            // the turn then keeps the saved model
            await sessionService.resolveTurnConfig({
                userId: user.userId,
                sessionId: session.id,
                billingSource: 'OWN_KEY',
                ...ownKey,
            })
            const settings = await prisma.sessionSettings.findUniqueOrThrow({
                where: { sessionId: session.id },
            })
            expect((settings.config as any).model).toBe('qwen-qwq-32b')
        })

        it('a model sent with the prompt wins', async () => {
            const user = await ownKeyUser()
            const session = await newSession(user, 'own-key-picked')
            await savedModel(session.id, 'qwen-qwq-32b')

            expect(
                await sessionService.resolveOwnKeyTurnModel({
                    userId: user.userId,
                    sessionId: session.id,
                    provider: 'groq',
                    model: 'llama-3.3-70b-versatile',
                })
            ).toEqual({ provider: 'groq', model: 'llama-3.3-70b-versatile' })
        })

        it('takes the default of the key when the session has no saved model, or the key no longer serves it', async () => {
            const user = await ownKeyUser()
            const fresh = await newSession(user, 'own-key-fresh')
            const gone = await newSession(user, 'own-key-gone')
            await savedModel(gone.id, 'a-model-the-key-lost')

            for (const session of [fresh, gone]) {
                expect(
                    await sessionService.resolveOwnKeyTurnModel({
                        userId: user.userId,
                        sessionId: session.id,
                        provider: 'groq',
                    })
                ).toEqual({ provider: 'groq', model: 'llama-3.3-70b-versatile' })
            }
        })
    })

    describe('a prompt with no text', () => {
        it('is refused', () => {
            expect(isBlankPrompt('')).toBe(true)
            expect(isBlankPrompt('  \n\t ')).toBe(true)
            expect(isBlankPrompt(undefined)).toBe(true)
            expect(isBlankPrompt(42)).toBe(true)
            expect(isBlankPrompt(' fix the test ')).toBe(false)
        })
    })

    describe('GET /session/sandboxes', () => {
        it('gives the start of the sandbox, not the start of the session', async () => {
            const user = await userWith()
            const resumed = await newSession(user, 'resumed', {
                createdAt: new Date('2026-11-01T08:00:00.000Z'),
                sandboxStartedAt: new Date('2026-11-25T09:30:00.000Z'),
            })
            const old = await newSession(user, 'from-before', {
                createdAt: new Date('2026-11-02T08:00:00.000Z'),
            })

            const res = await as(user.token).get('/session/sandboxes')

            expect(res.status).toBe(200)
            const started = Object.fromEntries(
                res.body.data.items.map((item: any) => [item.sessionId, item.startedAt])
            )
            expect(started[resumed.id]).toBe('2026-11-25T09:30:00.000Z')
            // no saved start: the start of the session
            expect(started[old.id]).toBe('2026-11-02T08:00:00.000Z')
        })
    })
})
