import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cliDispatcher } from '../../src/modules/cli/cli.dispatcher'
import { setMockSandboxRunner } from '../../src/modules/platform/platform.utils'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

import type { SandboxCommandOptions } from '../../src/modules/platform/platform.utils'

// issue 632 section 3: the session commands of the slash menu
describe('Session commands (#632)', () => {
    const stamp = Date.now()
    const ownerEmail = `cmd-owner-${stamp}@example.com`
    const otherEmail = `cmd-other-${stamp}@example.com`

    let ownerId: string
    let ownerToken: string
    let otherToken: string
    let resolveSpy: ReturnType<typeof spyOn>
    const modelPrompts: string[] = []
    let modelReply = 'a reply'
    const sandboxCommands: SandboxCommandOptions[] = []
    let sandboxStdout = ''

    const as = (token: string) => ({
        get: (path: string) =>
            request(app)
                .get(`/api/v1/session${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        post: (path: string, body?: object) =>
            request(app)
                .post(`/api/v1/session${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send(body ?? {}),
    })

    /** a session with alternating user and assistant messages */
    const makeSession = async (turns = 2, data: Record<string, unknown> = {}) => {
        const session = await prisma.session.create({
            data: { userId: ownerId, title: 'checkout flow', ...data },
        })
        let sequence = 0
        for (let turn = 1; turn <= turns; turn++) {
            sequence += 1
            await prisma.message.create({
                data: { sessionId: session.id, role: 'USER', content: `prompt ${turn}`, sequence },
            })
            sequence += 1
            await prisma.message.create({
                data: {
                    sessionId: session.id,
                    role: 'ASSISTANT',
                    content: `answer ${turn}`,
                    sequence,
                },
            })
        }
        return session
    }

    const machine = { vmId: 'sbx-live-1', sandboxStatus: 'RUNNING' as const }

    beforeAll(async () => {
        resolveSpy = spyOn(cliDispatcher, 'resolveServerProvider').mockReturnValue({
            provider: {
                id: 'gemini',
                name: 'Gemini',
                stream: async function* (messages: any[]) {
                    modelPrompts.push(messages[messages.length - 1]?.content || '')
                    yield { type: 'text', text: modelReply }
                    yield { type: 'usage', promptTokens: 300, completionTokens: 20 }
                },
            } as any,
            providerName: 'gemini',
            model: 'gemini-3.5-flash-lite',
        })
        setMockSandboxRunner(async (options) => {
            sandboxCommands.push(options)
            return { exitCode: 0, stdout: sandboxStdout, stderr: '' }
        })

        const owner = await prisma.user.create({
            data: {
                email: ownerEmail,
                name: 'Cmd Owner',
                emailVerified: true,
                creditBalance: 5000,
            },
        })
        ownerId = owner.id
        await prisma.user.create({
            data: { email: otherEmail, name: 'Cmd Other', emailVerified: true },
        })
        ownerToken = (await signInWithEmailCode(app, ownerEmail)).body.data.accessToken
        otherToken = (await signInWithEmailCode(app, otherEmail)).body.data.accessToken
    })

    beforeEach(() => {
        modelPrompts.length = 0
        sandboxCommands.length = 0
        sandboxStdout = ''
        modelReply = 'a reply'
    })

    afterAll(async () => {
        resolveSpy.mockRestore()
        setMockSandboxRunner(null)
        await cleanupTestUser(ownerEmail)
        await cleanupTestUser(otherEmail)
    })

    it('keeps every command to the owner of the session', async () => {
        const session = await makeSession()
        for (const path of ['context', 'turns', 'usage']) {
            const res = await as(otherToken).get(`/${session.id}/${path}`)
            expect(res.status).toBe(404)
        }
        const clear = await as(otherToken).post(`/${session.id}/clear`)
        expect(clear.status).toBe(404)
    })

    describe('/context, /clear and /compact', () => {
        it('/context counts the messages in context and reads the model limit', async () => {
            const session = await makeSession(2)
            await prisma.sessionSettings.create({
                data: {
                    sessionId: session.id,
                    config: { model: 'gemini-2.5-pro', provider: 'gemini' },
                },
            })
            const res = await as(ownerToken).get(`/${session.id}/context`)
            expect(res.status).toBe(200)
            expect(res.body.data.messages).toBe(4)
            expect(res.body.data.usedTokens).toBeGreaterThan(0)
            expect(res.body.data.model).toBe('gemini-2.5-pro')
            expect(res.body.data.limitTokens).toBeGreaterThan(100_000)
        })

        it('/clear moves the context start past the last message', async () => {
            const session = await makeSession(2)
            const res = await as(ownerToken).post(`/${session.id}/clear`)
            expect(res.status).toBe(200)
            expect(res.body.data.contextStartSequence).toBe(5)

            const context = await as(ownerToken).get(`/${session.id}/context`)
            expect(context.body.data).toMatchObject({ messages: 0, usedTokens: 0 })
            // the messages stay for the chat on the screen
            expect(await prisma.message.count({ where: { sessionId: session.id } })).toBe(4)
        })

        it('/compact saves a summary as the start of the context', async () => {
            const session = await makeSession(2)
            modelReply = 'Goal: a checkout flow.'
            const res = await as(ownerToken).post(`/${session.id}/compact`, { focus: 'payments' })
            expect(res.status).toBe(200)
            expect(res.body.data.summary).toBe('Goal: a checkout flow.')
            expect(res.body.data.sequence).toBe(5)
            expect(res.body.data.context.messages).toBe(1)
            expect(modelPrompts[0]).toContain('Keep this in focus: payments')
            expect(modelPrompts[0]).toContain('User: prompt 1')

            const row = await prisma.session.findUnique({ where: { id: session.id } })
            expect(row?.contextStartSequence).toBe(5)
            const summary = await prisma.message.findFirst({
                where: { sessionId: session.id, sequence: 5 },
            })
            expect(summary).toMatchObject({ role: 'ASSISTANT', status: 'summary' })
        })

        it('waits while the agent works, and needs something to compact', async () => {
            const running = await makeSession(1, { vmStatus: 'RUNNING' })
            expect((await as(ownerToken).post(`/${running.id}/compact`)).status).toBe(409)
            expect((await as(ownerToken).post(`/${running.id}/clear`)).status).toBe(409)

            const empty = await makeSession(0)
            expect((await as(ownerToken).post(`/${empty.id}/compact`)).status).toBe(400)
        })
    })

    describe('/rewind', () => {
        it('lists the prompts and goes back to one, files and chat', async () => {
            const session = await makeSession(3, machine)
            const turns = await as(ownerToken).get(`/${session.id}/turns`)
            expect(turns.body.data.turns.map((t: { sequence: number }) => t.sequence)).toEqual([
                5, 3, 1,
            ])

            sandboxStdout = 'RESTORED\n'
            const res = await as(ownerToken).post(`/${session.id}/rewind`, { sequence: 3 })
            expect(res.status).toBe(200)
            expect(res.body.data).toMatchObject({ prompt: 'prompt 2', filesRestored: true })
            expect(sandboxCommands[0]?.command).toContain('refs/december/turns/3')
            expect(sandboxCommands[0]?.sandboxId).toBe('sbx-live-1')

            const left = await prisma.message.findMany({
                where: { sessionId: session.id },
                orderBy: { sequence: 'asc' },
            })
            expect(left.map((message) => message.sequence)).toEqual([1, 2])
        })

        it('rewinds only the chat when there is no machine or no snapshot', async () => {
            const noMachine = await makeSession(2)
            const res = await as(ownerToken).post(`/${noMachine.id}/rewind`, { sequence: 3 })
            expect(res.body.data.filesRestored).toBe(false)
            expect(res.body.data.filesNote).toContain('machine is gone')
            expect(sandboxCommands).toHaveLength(0)

            const noSnapshot = await makeSession(2, machine)
            sandboxStdout = 'NO_CHECKPOINT\n'
            const second = await as(ownerToken).post(`/${noSnapshot.id}/rewind`, { sequence: 1 })
            expect(second.body.data.filesRestored).toBe(false)
            expect(second.body.data.filesNote).toContain('No file snapshot')
        })

        it('only goes back to a prompt in the context', async () => {
            const session = await makeSession(2, { contextStartSequence: 3 })
            expect(
                (await as(ownerToken).post(`/${session.id}/rewind`, { sequence: 1 })).status
            ).toBe(400)
            expect(
                (await as(ownerToken).post(`/${session.id}/rewind`, { sequence: 2 })).status
            ).toBe(400)
        })
    })

    describe('/fork', () => {
        it('copies the conversation and settings to a new session on the pushed branch', async () => {
            const source = await makeSession(2, {
                githubRepoOwner: 'acme',
                githubRepoName: 'shop',
                repoUrl: 'https://github.com/acme/shop',
                contextStartSequence: 3,
            })
            await prisma.sessionSettings.create({
                data: { sessionId: source.id, config: { planFirst: true, effort: 'fast' } },
            })

            const res = await as(ownerToken).post(`/${source.id}/fork`)
            expect(res.status).toBe(201)
            const fork = res.body.data.session
            expect(fork.id).not.toBe(source.id)
            expect(fork.title).toBe('checkout flow (fork)')
            expect(fork.branch).toBe(`december/${source.id}`)
            expect(fork.contextStartSequence).toBe(3)
            expect(await prisma.message.count({ where: { sessionId: fork.id } })).toBe(4)
            const settings = await prisma.sessionSettings.findUnique({
                where: { sessionId: fork.id },
            })
            expect(settings?.config).toEqual({ planFirst: true, effort: 'fast' })
        })
    })

    describe('/btw and /rename', () => {
        it('/btw answers from the conversation and saves nothing', async () => {
            const session = await makeSession(1)
            modelReply = 'It uses stripe.'
            const res = await as(ownerToken).post(`/${session.id}/btw`, {
                question: 'which payment provider?',
            })
            expect(res.status).toBe(200)
            expect(res.body.data.answer).toBe('It uses stripe.')
            expect(modelPrompts[0]).toContain('which payment provider?')
            expect(await prisma.message.count({ where: { sessionId: session.id } })).toBe(2)
        })

        it('/rename with no title writes one', async () => {
            const session = await makeSession(1)
            modelReply = '"Build the checkout flow."'
            const res = await as(ownerToken).post(`/${session.id}/title`)
            expect(res.status).toBe(200)
            expect(res.body.data.title).toBe('Build the checkout flow')
            const row = await prisma.session.findUnique({ where: { id: session.id } })
            expect(row?.title).toBe('Build the checkout flow')
        })
    })

    describe('/codesearch and /tasks', () => {
        it('/codesearch runs a fixed-text search in the machine', async () => {
            const session = await makeSession(1, machine)
            sandboxStdout = './src/cart.ts:12:  const total = sum(items)\nsrc/api.ts:3:total\n'
            const res = await as(ownerToken).get(`/${session.id}/code-search`).query({
                q: "it's total",
            })
            expect(res.status).toBe(200)
            expect(res.body.data.matches).toEqual([
                { path: 'src/cart.ts', line: 12, preview: 'const total = sum(items)' },
                { path: 'src/api.ts', line: 3, preview: 'total' },
            ])
            // the text is one quoted argument
            expect(sandboxCommands[0]?.command).toContain(`'it'\\''s total'`)
        })

        it('/tasks lists what the agent started, not the machine', async () => {
            const session = await makeSession(1, machine)
            sandboxStdout = [
                '    1     900 /sbin/init',
                '   12     890 /usr/bin/envd',
                '  340     120 node server.js',
                '  351       0 ps -eo pid=,etimes=,args= --sort=start_time',
            ].join('\n')
            const res = await as(ownerToken).get(`/${session.id}/tasks`)
            expect(res.body.data.tasks).toEqual([
                { pid: 340, elapsedSeconds: 120, command: 'node server.js' },
            ])
        })

        it('needs a machine', async () => {
            const session = await makeSession(1)
            const res = await as(ownerToken).get(`/${session.id}/tasks`)
            expect(res.status).toBe(409)
        })
    })

    describe('/usage, /check and /review', () => {
        it('/usage adds up the session, own-key runs cost no credits', async () => {
            const session = await makeSession(1)
            const period = { periodStart: new Date(), periodEnd: new Date() }
            await prisma.usageEvent.createMany({
                data: [
                    {
                        userId: ownerId,
                        sessionId: session.id,
                        model: 'gemini-2.5-pro',
                        inputTokens: 1000,
                        outputTokens: 200,
                        totalTokens: 1200,
                        costInCents: 2.5,
                        ...period,
                    },
                    {
                        userId: ownerId,
                        sessionId: session.id,
                        model: 'claude-sonnet-4-5',
                        billingSource: 'OWN_KEY',
                        inputTokens: 500,
                        outputTokens: 100,
                        totalTokens: 600,
                        costInCents: 9,
                        ...period,
                    },
                ],
            })
            const res = await as(ownerToken).get(`/${session.id}/usage`)
            expect(res.body.data).toMatchObject({
                inputTokens: 1500,
                outputTokens: 300,
                totalTokens: 1800,
                costInCents: 2.5,
            })
            expect(res.body.data.byModel).toHaveLength(2)
        })

        it('/check reports the account and the machine', async () => {
            const session = await makeSession(1, machine)
            const res = await as(ownerToken).get('/check').query({ sessionId: session.id })
            expect(res.status).toBe(200)
            expect(res.body.data).toMatchObject({
                github: { connected: false },
                gitlab: { connected: false },
                // earlier commands in this file spent a little of the 5000
                credits: { enoughToStart: true },
                keys: [],
                machine: { sandboxStatus: 'RUNNING' },
            })
            expect(res.body.data.credits.balanceInCents).toBeGreaterThan(4900)
        })

        it('/review starts a session that checks out the pull request and opens none', async () => {
            const res = await as(ownerToken).post('/review', {
                url: 'https://github.com/acme/shop/pull/42',
            })
            expect(res.status).toBe(201)
            expect(res.body.data.prompt).toContain('git fetch origin pull/42/head:review-42')
            expect(res.body.data.session).toMatchObject({
                title: 'Review acme/shop#42',
                githubRepoOwner: 'acme',
                githubRepoName: 'shop',
            })
            expect(res.body.data.session.config.openPullRequest).toBe(false)

            const bad = await as(ownerToken).post('/review', { url: 'https://example.com/x' })
            expect(bad.status).toBe(400)
        })
    })

    describe('prompts sent to a running session', () => {
        it('are saved once, and the first prompt of a new session is not saved twice', async () => {
            const created = await as(ownerToken).post('', { prompt: 'first' })
            const sessionId = created.body.data.session.id

            const first = await sessionService.recordUserPrompt({
                userId: ownerId,
                sessionId,
                prompt: 'first',
            })
            expect(first).toBe(1)
            await prisma.message.create({
                data: { sessionId, role: 'ASSISTANT', content: 'done', sequence: 2 },
            })
            const second = await sessionService.recordUserPrompt({
                userId: ownerId,
                sessionId,
                prompt: 'second',
            })
            expect(second).toBe(3)

            const notMine = await sessionService.recordUserPrompt({
                userId: 'someone-else',
                sessionId,
                prompt: 'x',
            })
            expect(notMine).toBeNull()
            expect(await prisma.message.count({ where: { sessionId } })).toBe(3)
        })
    })
})
