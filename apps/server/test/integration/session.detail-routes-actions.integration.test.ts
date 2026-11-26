import { prisma } from '@december/database'
import { getRedisClient, setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cliDispatcher } from '../../src/modules/cli/cli.dispatcher'
import { appCache } from '../../src/shared/cache'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

// the detail routes of one session that act: preview, stop, answers, disconnect, search
describe('session detail action routes', () => {
    const stamp = Date.now()
    const MISSING_ID = '00000000-0000-4000-8000-000000000000'
    const SECRET = `owner-secret-${stamp}`
    const redis = getRedisClient()
    const savedPublish = redis.publish
    const published: Array<{ channel: string; message: any }> = []
    const queued: Array<{ name: string; data: any }> = []

    let ownerId: string
    let strangerId: string
    let ownerToken: string
    let strangerToken: string
    let mainId: string
    let resolveSpy: any

    // what the fake model does for a search: answer, or fail after some text
    let searchMode: 'answer' | 'fail' = 'answer'
    const searchCalls: Array<{ messages: any[]; systemPrompt: string }> = []
    const SMART_REPLY = '{"topic":["zebra"]}'

    const as = (token?: string) => {
        const withAuth = (req: request.Test) => {
            const sent = req.set('x-forwarded-for', getRandomIP())
            return token ? sent.set('Authorization', `Bearer ${token}`) : sent
        }
        return {
            get: (path: string) => withAuth(request(app).get(`/api/v1${path}`)),
            post: (path: string, body?: object) =>
                withAuth(request(app).post(`/api/v1${path}`)).send(body ?? {}),
            put: (path: string) => withAuth(request(app).put(`/api/v1${path}`)),
        }
    }

    const makeUser = async (label: string) => {
        const email = `session-actions-${label}-${stamp}@example.com`
        const user = await prisma.user.create({
            data: { email, name: `Actions ${label}`, emailVerified: true, creditBalance: 5000 },
        })
        const token = authCookieToken(await signInWithEmailCode(app, email))
        return { id: user.id, token }
    }

    const expectNoLeak = (res: request.Response) => {
        expect(res.body.success).toBe(false)
        expect(res.body.data).toBeUndefined()
        expect(res.text).not.toContain(SECRET)
    }

    const interrupts = () =>
        published.filter((sent) => sent.channel.startsWith('session_interrupts:'))

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

        const mockProvider = {
            id: 'gemini',
            name: 'Gemini',
            stream: async function* (messages: any[], _tools: unknown, systemPrompt: string) {
                if (!systemPrompt.startsWith('You are December Search')) {
                    // smart search asks for filters
                    yield { type: 'text', text: SMART_REPLY }
                    yield { type: 'usage', promptTokens: 100, completionTokens: 10 }
                    return
                }
                searchCalls.push({ messages, systemPrompt })
                yield { type: 'thinking_delta', text: 'thinking' }
                yield { type: 'text', text: 'partial answer' }
                if (searchMode === 'fail') throw new Error('model went away')
                yield { type: 'text', text: ' and the rest' }
                yield { type: 'usage', promptTokens: 10, completionTokens: 5 }
            },
        }
        resolveSpy = spyOn(cliDispatcher, 'resolveServerProvider').mockReturnValue({
            provider: mockProvider as any,
            providerName: 'gemini',
            model: 'gemini-3.6-flash',
        })

        const owner = await makeUser('owner')
        const stranger = await makeUser('stranger')
        ownerId = owner.id
        ownerToken = owner.token
        strangerId = stranger.id
        strangerToken = stranger.token

        const main = await prisma.session.create({
            data: {
                userId: ownerId,
                title: `Main ${SECRET}`,
                vmId: `sbx${stamp}`,
                vmStatus: 'STOPPED',
                sandboxStatus: 'PAUSED',
                pendingQuestionAt: new Date(),
            },
        })
        mainId = main.id
    })

    afterAll(async () => {
        resolveSpy?.mockRestore()
        redis.publish = savedPublish
        setAgentQueue(null)
        const ids = [ownerId, strangerId].filter(Boolean)
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
        searchCalls.length = 0
        searchMode = 'answer'
    })

    // [name, how to send it for a session id]
    const actionRoutes: Array<[string, (token: string | undefined, id: string) => request.Test]> = [
        ['POST :id/preview-activity', (t, id) => as(t).post(`/session/${id}/preview-activity`)],
        ['POST :id/stop', (t, id) => as(t).post(`/session/${id}/stop`)],
        [
            'POST :id/question-answer',
            (t, id) => as(t).post(`/session/${id}/question-answer`, { answer: 'yes' }),
        ],
        ['POST :id/disconnect', (t, id) => as(t).post(`/session/${id}/disconnect`)],
        [
            'POST :id/search/stream',
            (t, id) => as(t).post(`/session/${id}/search/stream`, { prompt: 'hello' }),
        ],
        ['GET :id/preview', (t, id) => as(t).get(`/session/${id}/preview`)],
        ['GET :id/preview/:port', (t, id) => as(t).get(`/session/${id}/preview/3000`)],
        ['PUT :id/preview/:port', (t, id) => as(t).put(`/session/${id}/preview/3000`)],
    ]

    describe('refusals on the action routes', () => {
        for (const [name, send] of actionRoutes) {
            it(`${name} needs a sign-in (401)`, async () => {
                const res = await send(undefined, mainId)
                expect(res.status).toBe(401)
                expectNoLeak(res)
            })

            it(`${name} refuses an id that is not a uuid (400)`, async () => {
                const res = await send(ownerToken, 'not-a-uuid')
                expect(res.status).toBe(400)
                expect(res.body.errors.id).toBeDefined()
            })

            it(`${name} answers 404 for a missing session`, async () => {
                const res = await send(ownerToken, MISSING_ID)
                expect(res.status).toBe(404)
                expect(res.body.message).toBe('Session not found')
            })

            it(`${name} answers 404 for another user's session and changes nothing`, async () => {
                const before = await prisma.session.findUniqueOrThrow({ where: { id: mainId } })
                const messagesBefore = await prisma.message.count({ where: { sessionId: mainId } })

                const res = await send(strangerToken, mainId)

                expect(res.status).toBe(404)
                expectNoLeak(res)
                expect(interrupts()).toEqual([])
                expect(queued).toEqual([])
                expect(searchCalls).toEqual([])
                const after = await prisma.session.findUniqueOrThrow({ where: { id: mainId } })
                expect(after.pendingQuestionAt).toEqual(before.pendingQuestionAt)
                expect(after.vmLastActivityAt).toEqual(before.vmLastActivityAt)
                expect(after.title).toBe(before.title)
                expect(after.vmStatus).toBe(before.vmStatus)
                expect(after.sandboxStatus).toBe(before.sandboxStatus)
                expect(await prisma.message.count({ where: { sessionId: mainId } })).toBe(
                    messagesBefore
                )
            })
        }
    })

    describe('ALL /session/:id/preview', () => {
        it('takes port 3000 when none is given', async () => {
            const res = await as(ownerToken)
                .get(`/session/${mainId}/preview`)
                .set('Accept', 'application/json')
            expect(res.status).toBe(200)
            expect(res.body.data.port).toBe(3000)
            expect(res.body.data.targetHost).toBe(`3000-sbx${stamp}.e2b.dev`)
            expect(res.body.data.previewUrl).toBe(`https://3000-sbx${stamp}.e2b.dev/`)
            expect(res.headers['x-forwarded-host']).toBe(`3000-sbx${stamp}.e2b.dev`)
        })

        it('keeps the path of the page', async () => {
            for (const [path, expected] of [
                ['api/users', '/api/users'],
                ['/docs?x=1', '/docs?x=1'],
            ]) {
                const res = await as(ownerToken)
                    .get(`/session/${mainId}/preview/8080`)
                    .query({ path })
                    .set('Accept', 'application/json')
                expect(res.status).toBe(200)
                expect(res.body.data.previewUrl).toBe(`https://8080-sbx${stamp}.e2b.dev${expected}`)
            }
        })

        it('sends a browser on to the e2b sandbox', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/preview/5173`)
            expect(res.status).toBe(302)
            expect(res.headers.location).toBe(`https://5173-sbx${stamp}.e2b.dev/`)
        })

        it('shows a page for a session with no sandbox', async () => {
            for (const vmId of [null, 'mock-abc']) {
                const session = await prisma.session.create({
                    data: { userId: ownerId, title: 'No sandbox', vmId },
                })
                const res = await as(ownerToken).get(`/session/${session.id}/preview/4000`)
                expect(res.status).toBe(200)
                expect(res.headers['content-type']).toContain('text/html')
                expect(res.text).toContain('Port 4000')
                expect(res.text).toContain(`session-${session.id}-4000.preview.trydecember.com`)
            }
        })

        it('answers any method', async () => {
            const res = await as(ownerToken)
                .post(`/session/${mainId}/preview/3000`)
                .set('Accept', 'application/json')
            expect(res.status).toBe(200)
            expect(res.body.data.port).toBe(3000)
        })

        for (const port of ['abc', '0', '65536', '1.5', '-1']) {
            it(`refuses port ${port} (400)`, async () => {
                const res = await as(ownerToken)
                    .get(`/session/${mainId}/preview/${port}`)
                    .set('Accept', 'application/json')
                expect(res.status).toBe(400)
                expect(res.body.errors.port).toBeDefined()
            })
        }

        it('takes the highest port, 65535', async () => {
            const res = await as(ownerToken)
                .get(`/session/${mainId}/preview/65535`)
                .set('Accept', 'application/json')
            expect(res.status).toBe(200)
            expect(res.body.data.port).toBe(65535)
        })

        it('counts as activity on a running sandbox', async () => {
            const old = new Date(Date.now() - 5 * 60 * 1000)
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Live preview',
                    vmId: `sbx-live-${stamp}`,
                    sandboxStatus: 'RUNNING',
                    vmLastActivityAt: old,
                },
            })
            const res = await as(ownerToken)
                .get(`/session/${session.id}/preview/3000`)
                .set('Accept', 'application/json')
            expect(res.status).toBe(200)
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.vmLastActivityAt!.getTime()).toBeGreaterThan(old.getTime())
        })
    })

    describe('POST /session/:id/preview-activity', () => {
        it('marks a running sandbox as in use', async () => {
            const old = new Date(Date.now() - 5 * 60 * 1000)
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Watched',
                    vmId: `sbx-watch-${stamp}`,
                    sandboxStatus: 'RUNNING',
                    vmLastActivityAt: old,
                },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/preview-activity`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ sessionId: session.id })
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.vmLastActivityAt!.getTime()).toBeGreaterThan(old.getTime())
        })

        it('writes once per 30 seconds', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Pinged twice',
                    sandboxStatus: 'RUNNING',
                },
            })
            const first = await as(ownerToken).post(`/session/${session.id}/preview-activity`)
            expect(first.status).toBe(200)
            const old = new Date(Date.now() - 5 * 60 * 1000)
            await prisma.session.update({
                where: { id: session.id },
                data: { vmLastActivityAt: old },
            })

            const second = await as(ownerToken).post(`/session/${session.id}/preview-activity`)
            expect(second.status).toBe(200)
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.vmLastActivityAt).toEqual(old)
        })

        it('leaves a paused or stopped sandbox alone', async () => {
            for (const sandboxStatus of ['PAUSED', 'STOPPED', null] as const) {
                const session = await prisma.session.create({
                    data: { userId: ownerId, title: `Idle ${sandboxStatus}`, sandboxStatus },
                })
                const res = await as(ownerToken).post(`/session/${session.id}/preview-activity`)
                expect(res.status).toBe(200)
                const after = await prisma.session.findUniqueOrThrow({
                    where: { id: session.id },
                })
                expect(after.vmLastActivityAt).toBeNull()
            }
        })

        it("does not keep another user's sandbox awake", async () => {
            const old = new Date(Date.now() - 5 * 60 * 1000)
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Not yours',
                    sandboxStatus: 'RUNNING',
                    vmLastActivityAt: old,
                },
            })
            const res = await as(strangerToken).post(`/session/${session.id}/preview-activity`)
            expect(res.status).toBe(404)
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.vmLastActivityAt).toEqual(old)
        })
    })

    describe('POST /session/:id/stop', () => {
        it('stops an agent whose sandbox still starts, with no pause job', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Starting',
                    vmId: `sbx-start-${stamp}`,
                    vmStatus: 'PROVISIONING',
                    sandboxStatus: 'STARTING',
                },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/stop`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                sessionId: session.id,
                vmStatus: 'STOPPED',
                sandboxStatus: 'STARTING',
            })
            expect(interrupts()).toHaveLength(1)
            expect(interrupts()[0]!.message).toEqual({ type: 'INTERRUPT', reason: 'user' })
            expect(queued).toEqual([])
        })

        it('keeps a failed status as it is', async () => {
            const session = await prisma.session.create({
                data: { userId: ownerId, title: 'Failed', vmStatus: 'FAILED' },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/stop`)
            expect(res.status).toBe(200)
            expect(res.body.data.vmStatus).toBe('FAILED')
            expect(res.body.data.sandboxStatus).toBeNull()
            expect(queued).toEqual([])
        })

        it('answers an open spend limit question with a stop', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Limit then stop',
                    vmStatus: 'STOPPED',
                    limitQuestionKind: 'session',
                    limitQuestionCents: 500,
                    pendingQuestionAt: new Date(),
                },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/stop`)
            expect(res.status).toBe(200)
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.limitQuestionKind).toBeNull()
            expect(after.limitQuestionCents).toBeNull()
            expect(after.pendingQuestionAt).toBeNull()
        })

        it("does not end another user's spend limit question", async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Limit kept',
                    limitQuestionKind: 'day',
                    limitQuestionCents: 1000,
                    pendingQuestionAt: new Date(),
                },
            })
            const res = await as(strangerToken).post(`/session/${session.id}/stop`)
            expect(res.status).toBe(404)
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.limitQuestionKind).toBe('day')
            expect(after.pendingQuestionAt).not.toBeNull()
        })
    })

    describe('POST /session/:id/question-answer', () => {
        const badBodies: Array<[string, object]> = [
            ['no answer', {}],
            ['an answer that is a number', { answer: 3 }],
            ['an answer list with a number', { answer: ['a', 2] }],
            ['a question id that is a number', { answer: 'a', questionId: 7 }],
            ['an answer of null', { answer: null }],
        ]
        for (const [label, body] of badBodies) {
            it(`refuses ${label} (400)`, async () => {
                const res = await as(ownerToken).post(`/session/${mainId}/question-answer`, body)
                expect(res.status).toBe(400)
                expect(res.body.message).toBe('validation failed')
            })
        }

        it('takes an answer and ends the wait', async () => {
            const session = await prisma.session.create({
                data: { userId: ownerId, title: 'Asked', pendingQuestionAt: new Date() },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/question-answer`, {
                questionId: 'q-1',
                answer: 'Tailwind',
            })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                success: true,
                sessionId: session.id,
                questionId: 'q-1',
                answer: 'Tailwind',
            })
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.pendingQuestionAt).toBeNull()
        })

        it('takes a list of answers', async () => {
            const session = await prisma.session.create({
                data: { userId: ownerId, title: 'Multi', pendingQuestionAt: new Date() },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/question-answer`, {
                questionId: 'q-2',
                answer: ['a', 'b'],
            })
            expect(res.status).toBe(200)
            expect(res.body.data.answer).toEqual(['a', 'b'])
        })

        it('takes an answer when nothing waits', async () => {
            const session = await prisma.session.create({
                data: { userId: ownerId, title: 'Not asked' },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/question-answer`, {
                questionId: 'q-3',
                answer: 'ok',
            })
            expect(res.status).toBe(200)
            expect(res.body.data.success).toBe(true)
        })

        it('"Stop here" ends the spend limit question and runs nothing', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Limit',
                    limitQuestionKind: 'session',
                    limitQuestionCents: 500,
                    pendingQuestionAt: new Date(),
                    limitHeldRun: { prompt: 'go on' },
                },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/question-answer`, {
                questionId: 'spend-limit:session',
                answer: 'Stop here',
            })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual(
                expect.objectContaining({
                    success: true,
                    sessionId: session.id,
                    questionId: 'spend-limit:session',
                    handled: true,
                    continued: false,
                })
            )
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.limitQuestionKind).toBeNull()
            expect(after.limitQuestionCents).toBeNull()
            expect(after.limitHeldRun).toBeNull()
            expect(after.pendingQuestionAt).toBeNull()
            expect(queued).toEqual([])
            const answered = published.find(
                (sent) => sent.channel === `session_events:${session.id}`
            )
            expect(answered?.message).toEqual({
                type: 'SpendLimitAnswered',
                sessionId: session.id,
                answer: 'Stop here',
            })
        })

        it('an answer with no question id goes to an open spend limit question', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Limit no id',
                    limitQuestionKind: 'day',
                    limitQuestionCents: 2000,
                    pendingQuestionAt: new Date(),
                },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/question-answer`, {
                answer: ['something else'],
            })
            expect(res.status).toBe(200)
            expect(res.body.data.handled).toBe(true)
            expect(res.body.data.continued).toBe(false)
            expect(res.body.data.questionId).toBe('spend-limit:day')
            expect(queued).toEqual([])
        })

        it('an answer to an agent question keeps the spend limit question open', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Limit and agent',
                    limitQuestionKind: 'session',
                    limitQuestionCents: 500,
                    pendingQuestionAt: new Date(),
                },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/question-answer`, {
                questionId: 'agent-q-9',
                answer: 'Continue',
            })
            expect(res.status).toBe(200)
            expect(res.body.data.handled).toBeUndefined()
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.limitQuestionKind).toBe('session')
            expect(after.pendingQuestionAt).not.toBeNull()
            expect(queued).toEqual([])
        })

        it("another user's answer does not end the wait", async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Owner waits',
                    limitQuestionKind: 'session',
                    limitQuestionCents: 500,
                    pendingQuestionAt: new Date(),
                },
            })
            const res = await as(strangerToken).post(`/session/${session.id}/question-answer`, {
                answer: 'Stop here',
            })
            expect(res.status).toBe(404)
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.limitQuestionKind).toBe('session')
            expect(after.pendingQuestionAt).not.toBeNull()
            expect(published).toEqual([])
        })
    })

    describe('POST /session/:id/disconnect', () => {
        it('acknowledges and leaves the run and the sandbox as they are', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Busy',
                    vmId: `sbx-busy-${stamp}`,
                    vmStatus: 'RUNNING',
                    sandboxStatus: 'RUNNING',
                },
            })
            const res = await as(ownerToken).post(`/session/${session.id}/disconnect`)
            expect(res.status).toBe(200)
            expect(res.body.data.message).toContain('Disconnect acknowledged')
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.vmStatus).toBe('RUNNING')
            expect(after.sandboxStatus).toBe('RUNNING')
            expect(interrupts()).toEqual([])
            expect(queued).toEqual([])
        })
    })

    describe('POST /session/:id/search/stream', () => {
        const newSearch = (title = 'New Session') =>
            prisma.session.create({
                data: { userId: ownerId, title, type: 'SEARCH', vmStatus: 'STOPPED' },
            })

        const badBodies: Array<[string, object]> = [
            ['no prompt', {}],
            ['an empty prompt', { prompt: '' }],
            ['a prompt that is a number', { prompt: 5 }],
            ['a history that is not a list', { prompt: 'hi', messageHistory: 'old' }],
            [
                'a history with an unknown role',
                { prompt: 'hi', messageHistory: [{ role: 'robot' }] },
            ],
            [
                'a history with text that is a number',
                {
                    prompt: 'hi',
                    messageHistory: [{ role: 'user', content: 1 }],
                },
            ],
        ]
        for (const [label, body] of badBodies) {
            it(`refuses ${label} (400) and calls no model`, async () => {
                const res = await as(ownerToken).post(`/session/${mainId}/search/stream`, body)
                expect(res.status).toBe(400)
                expect(searchCalls).toEqual([])
            })
        }

        it('refuses a coding session (400), calls no model and saves nothing', async () => {
            const coding = await prisma.session.create({
                data: { userId: ownerId, title: 'Coding', type: 'WEB', vmStatus: 'STOPPED' },
            })
            const res = await as(ownerToken).post(`/session/${coding.id}/search/stream`, {
                prompt: 'what is a monad?',
            })
            expect(res.status).toBe(400)
            expect(searchCalls).toEqual([])
            expect(await prisma.message.count({ where: { sessionId: coding.id } })).toBe(0)
            expect(await prisma.usageEvent.count({ where: { sessionId: coding.id } })).toBe(0)
        })

        it('streams the answer and saves both messages after the ones before', async () => {
            const session = await newSearch('Kept title')
            await prisma.message.createMany({
                data: [
                    { sessionId: session.id, role: 'USER', content: 'earlier', sequence: 1 },
                    { sessionId: session.id, role: 'ASSISTANT', content: 'reply', sequence: 2 },
                ],
            })
            const res = await as(ownerToken).post(`/session/${session.id}/search/stream`, {
                prompt: 'next question',
            })
            expect(res.status).toBe(200)
            expect(res.headers['content-type']).toContain('text/event-stream')
            expect(res.text).toContain('event: thought')
            expect(res.text).toContain('event: token')
            expect(res.text).toContain('event: done')

            // with no history sent, the saved conversation goes to the model
            expect(searchCalls).toHaveLength(1)
            expect(searchCalls[0]!.messages).toEqual([
                { role: 'user', content: 'earlier' },
                { role: 'assistant', content: 'reply' },
                { role: 'user', content: 'next question' },
            ])

            const messages = await prisma.message.findMany({
                where: { sessionId: session.id },
                orderBy: { sequence: 'asc' },
            })
            expect(messages.map((m) => [m.sequence, m.role, m.content])).toEqual([
                [1, 'USER', 'earlier'],
                [2, 'ASSISTANT', 'reply'],
                [3, 'USER', 'next question'],
                [4, 'ASSISTANT', 'partial answer and the rest'],
            ])
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.title).toBe('Kept title')
        })

        it('sends the history from the client, with roles in any case', async () => {
            const session = await newSearch()
            const res = await as(ownerToken).post(`/session/${session.id}/search/stream`, {
                prompt: 'and then?',
                messageHistory: [
                    { role: 'USER', content: 'first' },
                    { role: 'Assistant', content: 'second' },
                    { role: 'system' },
                ],
            })
            expect(res.status).toBe(200)
            expect(searchCalls[0]!.messages).toEqual([
                { role: 'user', content: 'first' },
                { role: 'assistant', content: 'second' },
                { role: 'system', content: '' },
                { role: 'user', content: 'and then?' },
            ])
        })

        it('names a new session after a short prompt', async () => {
            const session = await newSearch()
            await as(ownerToken).post(`/session/${session.id}/search/stream`, {
                prompt: 'what is bun',
            })
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.title).toBe('what is bun')
        })

        it('names a new session after the start of a long prompt', async () => {
            const session = await newSearch('Untitled Session')
            const prompt = 'p'.repeat(80)
            await as(ownerToken).post(`/session/${session.id}/search/stream`, { prompt })
            const after = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
            expect(after.title).toBe(`${'p'.repeat(47)}...`)
        })

        it('records the usage of the answer on the session', async () => {
            const session = await newSearch()
            await as(ownerToken).post(`/session/${session.id}/search/stream`, { prompt: 'cost?' })
            const events = await prisma.usageEvent.findMany({ where: { sessionId: session.id } })
            expect(events).toHaveLength(1)
            expect(events[0]!.userId).toBe(ownerId)
            expect(events[0]!.inputTokens).toBe(10)
            expect(events[0]!.outputTokens).toBe(5)
        })

        it('ends the stream with an error event when the model fails, and keeps the prompt', async () => {
            searchMode = 'fail'
            const session = await newSearch('Breaks')
            const res = await as(ownerToken).post(`/session/${session.id}/search/stream`, {
                prompt: 'break please',
            })
            expect(res.status).toBe(200)
            expect(res.text).toContain('event: error')
            // a plain line for the client: no provider or database error text
            expect(res.text).toContain('The answer could not be finished. Try again.')
            expect(res.text).not.toContain('model went away')
            expect(res.text).not.toContain('event: done')
            const messages = await prisma.message.findMany({ where: { sessionId: session.id } })
            expect(messages.map((m) => m.role)).toEqual(['USER'])
            expect(await prisma.usageEvent.count({ where: { sessionId: session.id } })).toBe(0)
        })

        it('prompts sent at once are all saved in turn, with no server error', async () => {
            const session = await newSearch('At once')
            const prompts = ['one', 'two', 'three']

            const results = await Promise.all(
                prompts.map((prompt) =>
                    as(ownerToken).post(`/session/${session.id}/search/stream`, { prompt })
                )
            )

            for (const res of results) {
                expect(res.status).toBe(200)
                expect(res.text).toContain('event: done')
                expect(res.text).not.toContain('event: error')
            }
            const messages = await prisma.message.findMany({
                where: { sessionId: session.id },
                orderBy: { sequence: 'asc' },
            })
            // six messages with the sequences 1 to 6, each prompt once, each answer once
            expect(messages.map((m) => m.sequence)).toEqual([1, 2, 3, 4, 5, 6])
            expect(
                messages
                    .filter((m) => m.role === 'USER')
                    .map((m) => m.content)
                    .sort()
            ).toEqual([...prompts].sort())
            expect(messages.filter((m) => m.role === 'ASSISTANT')).toHaveLength(3)
            expect(await prisma.usageEvent.count({ where: { sessionId: session.id } })).toBe(3)
        })

        it('another user cannot search in a session or read its messages', async () => {
            const session = await newSearch(`Search ${SECRET}`)
            await prisma.message.create({
                data: { sessionId: session.id, role: 'USER', content: SECRET, sequence: 1 },
            })
            const res = await as(strangerToken).post(`/session/${session.id}/search/stream`, {
                prompt: 'what did they ask?',
            })
            expect(res.status).toBe(404)
            expectNoLeak(res)
            expect(searchCalls).toEqual([])
            expect(await prisma.message.count({ where: { sessionId: session.id } })).toBe(1)
            expect(await prisma.usageEvent.count({ where: { userId: strangerId } })).toBe(0)
        })
    })

    describe('GET /session/smart-search', () => {
        beforeAll(async () => {
            await prisma.session.create({
                data: { userId: ownerId, title: 'Zebra stripes for the owner' },
            })
            await prisma.session.create({
                data: { userId: strangerId, title: `Zebra ${SECRET}` },
            })
        })

        beforeEach(async () => {
            await appCache.clearAll()
        })

        it('needs a sign-in (401)', async () => {
            const res = await as().get('/session/smart-search?q=zebra')
            expect(res.status).toBe(401)
        })

        for (const [label, q] of [
            ['a query under 3 characters', 'ab'],
            ['a query of spaces', '      '],
            ['a query over 200 characters', 'z'.repeat(201)],
        ]) {
            it(`refuses ${label} (400)`, async () => {
                const res = await as(ownerToken).get('/session/smart-search').query({ q })
                expect(res.status).toBe(400)
                expect(res.body.errors.q).toBeDefined()
            })
        }

        it("finds the user's own sessions only", async () => {
            const res = await as(ownerToken).get('/session/smart-search').query({ q: 'zebra' })
            expect(res.status).toBe(200)
            expect(res.body.data.applied).toBe(true)
            const titles = res.body.data.sessions.map((s: any) => s.title)
            expect(titles).toContain('Zebra stripes for the owner')
            expect(res.text).not.toContain(SECRET)
            for (const session of res.body.data.sessions) {
                expect(session.userId ?? ownerId).toBe(ownerId)
            }
        })

        it('does not give one user the cached results of another', async () => {
            const first = await as(ownerToken).get('/session/smart-search').query({ q: 'zebra' })
            expect(first.status).toBe(200)
            const second = await as(strangerToken)
                .get('/session/smart-search')
                .query({ q: 'zebra' })
            expect(second.status).toBe(200)
            const titles = second.body.data.sessions.map((s: any) => s.title)
            expect(titles).toEqual([`Zebra ${SECRET}`])
        })
    })
})
