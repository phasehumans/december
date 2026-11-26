import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { ensureStorageBucket } from '../../src/config/s3'
import { runtimeService } from '../../src/modules/runtime/runtime.service'
import {
    deletePrefix,
    putTextFile,
    sessionPrefix,
    sessionWorkspaceKey,
} from '../../src/shared/project-storage'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

// the detail routes of one session: create, read, messages and the read-only views
describe('session detail routes', () => {
    const stamp = Date.now()
    const MISSING_ID = '00000000-0000-4000-8000-000000000000'
    // a word only the owner's data has: a reply to anybody else must not hold it
    const SECRET = `owner-secret-${stamp}`

    let ownerId: string
    let strangerId: string
    let brokeId: string
    let busyId: string
    let ownerToken: string
    let strangerToken: string
    let brokeToken: string
    let busyToken: string

    // the owner's main session, with messages, a sandbox and a file
    let mainId: string
    const storedSessionIds: string[] = []

    const as = (token?: string) => {
        const withAuth = (req: request.Test) => {
            const sent = req.set('x-forwarded-for', getRandomIP())
            return token ? sent.set('Authorization', `Bearer ${token}`) : sent
        }
        return {
            get: (path: string) => withAuth(request(app).get(`/api/v1${path}`)),
            post: (path: string, body?: object) =>
                withAuth(request(app).post(`/api/v1${path}`)).send(body ?? {}),
        }
    }

    const makeUser = async (label: string, creditBalance: number) => {
        const email = `session-detail-${label}-${stamp}@example.com`
        const user = await prisma.user.create({
            data: { email, name: `Detail ${label}`, emailVerified: true, creditBalance },
        })
        const token = authCookieToken(await signInWithEmailCode(app, email))
        return { id: user.id, token }
    }

    /** the body of a refusal must not carry any data of the owner */
    const expectNoLeak = (res: request.Response) => {
        expect(res.body.success).toBe(false)
        expect(res.body.data).toBeUndefined()
        expect(JSON.stringify(res.body)).not.toContain(SECRET)
        expect(res.text).not.toContain(SECRET)
    }

    beforeAll(async () => {
        await ensureStorageBucket()
        const owner = await makeUser('owner', 5000)
        const stranger = await makeUser('stranger', 5000)
        const broke = await makeUser('broke', 0)
        const busy = await makeUser('busy', 5000)
        ownerId = owner.id
        ownerToken = owner.token
        strangerId = stranger.id
        strangerToken = stranger.token
        brokeId = broke.id
        brokeToken = broke.token
        busyId = busy.id
        busyToken = busy.token

        const main = await prisma.session.create({
            data: {
                userId: ownerId,
                title: `Main ${SECRET}`,
                githubRepoOwner: 'acme',
                githubRepoName: 'shop',
                vmId: `vm-detail-${stamp}`,
                vmStatus: 'STOPPED',
                sandboxStatus: 'PAUSED',
            },
        })
        mainId = main.id
        storedSessionIds.push(mainId)
        await putTextFile({
            key: sessionWorkspaceKey(mainId, 'src/secret.ts'),
            content: `export const value = '${SECRET}'\n`,
        })
    })

    afterAll(async () => {
        for (const sessionId of storedSessionIds) {
            await deletePrefix(sessionPrefix(sessionId)).catch((error: unknown) => {
                console.warn('[test] could not remove stored files:', error)
            })
        }
        const ids = [ownerId, strangerId, brokeId, busyId].filter(Boolean)
        await prisma.project.deleteMany({ where: { userId: { in: ids } } })
        await prisma.session.deleteMany({ where: { userId: { in: ids } } })
        for (const id of ids) {
            await cleanupTestUser({ id })
        }
    })

    // every read route that takes a session id refuses the same way
    const readRoutes = [
        '',
        '/messages',
        '/diff',
        '/files',
        '/file?path=src/secret.ts',
        '/pull-requests',
        '/plan',
        '/tests',
        '/preview-port',
        '/desktop-viewport',
        '/pending-question',
    ]

    describe('refusals on the read routes', () => {
        for (const suffix of readRoutes) {
            const name = suffix || '/'
            it(`GET :id${name} needs a sign-in (401)`, async () => {
                const res = await as().get(`/session/${mainId}${suffix}`)
                expect(res.status).toBe(401)
                expectNoLeak(res)
            })

            it(`GET :id${name} refuses an id that is not a uuid (400)`, async () => {
                const res = await as(ownerToken).get(`/session/not-a-uuid${suffix}`)
                expect(res.status).toBe(400)
                expect(res.body.message).toBe('validation failed')
                expect(res.body.errors.id).toBeDefined()
            })

            it(`GET :id${name} answers 404 for a missing session`, async () => {
                const res = await as(ownerToken).get(`/session/${MISSING_ID}${suffix}`)
                expect(res.status).toBe(404)
                expect(res.body.message).toBe('Session not found')
            })

            it(`GET :id${name} answers 404 for another user's session and shows nothing`, async () => {
                const res = await as(strangerToken).get(`/session/${mainId}${suffix}`)
                expect(res.status).toBe(404)
                expectNoLeak(res)
            })
        }
    })

    describe('POST /session', () => {
        it('needs a sign-in (401)', async () => {
            const res = await as().post('/session', { prompt: 'hello' })
            expect(res.status).toBe(401)
        })

        const badBodies: Array<[string, object]> = [
            ['a title over 100 characters', { title: 'x'.repeat(101) }],
            ['an unknown type', { type: 'DESKTOP' }],
            ['an empty prompt', { prompt: '' }],
            ['a prompt that is not text', { prompt: 42 }],
            ['a project id that is not a uuid', { projectId: 'project-1' }],
            ['a repo link that is not a link', { repoUrl: 'acme/shop' }],
            ['a repo link that is not http', { repoUrl: 'ftp://github.com/acme/shop' }],
            ['a branch that starts with a dash', { branch: '-rf' }],
            ['a branch with a space', { branch: 'my branch' }],
            ['a branch with shell characters', { branch: 'main;rm' }],
            ['a git ref with a backtick', { gitRef: 'a`b' }],
            ['a branch over 100 characters', { branch: 'b'.repeat(101) }],
            ['an issue number of 0', { issueNumber: 0 }],
            ['an issue number that is not whole', { issueNumber: 1.5 }],
            ['an issue number as text', { issueNumber: '12' }],
            ['an unknown billing source', { billingSource: 'FREE' }],
            ['an unknown tier', { tier: 'medium' }],
            ['an unknown effort', { effort: 'slow' }],
            ['plan first as text', { planFirst: 'yes' }],
            ['open pull request as text', { openPullRequest: 'true' }],
            ['a provider over 64 characters', { provider: 'p'.repeat(65) }],
            ['a model over 200 characters', { model: 'm'.repeat(201) }],
            [
                '51 disabled plugins',
                { disabledPlugins: Array.from({ length: 51 }, (_, i) => `p${i}`) },
            ],
            ['an empty disabled mcp name', { disabledMcps: [''] }],
        ]
        for (const [label, body] of badBodies) {
            it(`refuses ${label} (400) and saves nothing`, async () => {
                const before = await prisma.session.count({ where: { userId: ownerId } })
                const res = await as(ownerToken).post('/session', body)
                expect(res.status).toBe(400)
                expect(res.body.message).toBe('validation failed')
                expect(await prisma.session.count({ where: { userId: ownerId } })).toBe(before)
            })
        }

        it('answers 402 to a user with no credits and saves nothing', async () => {
            const res = await as(brokeToken).post('/session', { prompt: 'build it' })
            expect(res.status).toBe(402)
            expect(res.body.message).toContain('Insufficient balance')
            expect(await prisma.session.count({ where: { userId: brokeId } })).toBe(0)
        })

        it('answers 402 to a search session of a user with no credits', async () => {
            const res = await as(brokeToken).post('/session', { type: 'SEARCH' })
            expect(res.status).toBe(402)
            expect(res.body.message).toContain('$0.01')
            expect(await prisma.session.count({ where: { userId: brokeId } })).toBe(0)
        })

        it('creates a session with no fields: a stopped web session named "New Session"', async () => {
            const res = await as(ownerToken).post('/session', {})
            expect(res.status).toBe(201)
            const session = res.body.data.session
            expect(session.userId).toBe(ownerId)
            expect(session.title).toBe('New Session')
            expect(session.type).toBe('WEB')
            expect(session.vmStatus).toBe('STOPPED')
            expect(session.vmId).toBeNull()
            expect(session.config).toEqual(
                expect.objectContaining({
                    planFirst: expect.any(Boolean),
                    effort: expect.any(String),
                    openPullRequest: expect.any(Boolean),
                })
            )
            expect(await prisma.message.count({ where: { sessionId: session.id } })).toBe(0)
            const settings = await prisma.sessionSettings.findUnique({
                where: { sessionId: session.id },
            })
            expect(settings).not.toBeNull()
        })

        it('saves the prompt as the first message', async () => {
            const res = await as(ownerToken).post('/session', { prompt: 'add a footer' })
            expect(res.status).toBe(201)
            const messages = await prisma.message.findMany({
                where: { sessionId: res.body.data.session.id },
            })
            expect(messages).toHaveLength(1)
            expect(messages[0]).toEqual(
                expect.objectContaining({ role: 'USER', content: 'add a footer', sequence: 1 })
            )
        })

        it('reads the repository from a github link and names the session after it', async () => {
            const res = await as(ownerToken).post('/session', {
                repoUrl: 'https://github.com/acme/shop',
                branch: 'feature/login',
                gitRef: 'v1.2.0',
                issueNumber: 12,
            })
            expect(res.status).toBe(201)
            const session = res.body.data.session
            expect(session.title).toBe('shop #12')
            expect(session.githubRepoOwner).toBe('acme')
            expect(session.githubRepoName).toBe('shop')
            expect(session.githubRepoUrl).toBe('https://github.com/acme/shop')
            expect(session.repoUrl).toBe('https://github.com/acme/shop')
            expect(session.gitProvider).toBe('GITHUB')
            expect(session.branch).toBe('feature/login')
            expect(session.gitRef).toBe('v1.2.0')
            expect(session.issueNumber).toBe(12)
        })

        it('knows a gitlab link', async () => {
            const res = await as(ownerToken).post('/session', {
                repoUrl: 'https://gitlab.com/acme/api',
            })
            expect(res.status).toBe(201)
            expect(res.body.data.session.gitProvider).toBe('GITLAB')
            expect(res.body.data.session.githubRepoName).toBe('api')
            expect(res.body.data.session.title).toBe('api')
        })

        it('keeps a title that is sent over the repository name', async () => {
            const res = await as(ownerToken).post('/session', {
                title: 'My own title',
                repoUrl: 'https://github.com/acme/shop',
            })
            expect(res.status).toBe(201)
            expect(res.body.data.session.title).toBe('My own title')
        })

        it('ignores fields the body may not set: the owner, the status and the sandbox', async () => {
            const res = await as(ownerToken).post('/session', {
                userId: strangerId,
                vmStatus: 'RUNNING',
                vmId: 'vm-forged',
                sandboxStatus: 'RUNNING',
                isArchived: true,
            })
            expect(res.status).toBe(201)
            const saved = await prisma.session.findUnique({
                where: { id: res.body.data.session.id },
            })
            expect(saved?.userId).toBe(ownerId)
            expect(saved?.vmStatus).toBe('STOPPED')
            expect(saved?.vmId).toBeNull()
            expect(saved?.sandboxStatus).toBeNull()
            expect(saved?.isArchived).toBe(false)
        })

        it('saves the configuration and the switched off plugins and mcp servers', async () => {
            const res = await as(ownerToken).post('/session', {
                planFirst: true,
                effort: 'deep',
                openPullRequest: false,
                disabledPlugins: ['lint'],
                disabledMcps: ['figma'],
            })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config).toEqual(
                expect.objectContaining({ planFirst: true, effort: 'deep', openPullRequest: false })
            )
            const settings = await prisma.sessionSettings.findUnique({
                where: { sessionId: res.body.data.session.id },
            })
            expect(settings?.config).toEqual(
                expect.objectContaining({ disabledPlugins: ['lint'], disabledMcps: ['figma'] })
            )
        })

        it('creates a search session', async () => {
            const res = await as(ownerToken).post('/session', { type: 'SEARCH' })
            expect(res.status).toBe(201)
            expect(res.body.data.session.type).toBe('SEARCH')
        })

        it('answers 409 at 10 working sessions, but still starts a search session', async () => {
            await prisma.session.createMany({
                data: Array.from({ length: 10 }, (_, index) => ({
                    userId: busyId,
                    title: `working ${index}`,
                    vmStatus: index % 2 === 0 ? ('RUNNING' as const) : ('PROVISIONING' as const),
                })),
            })

            const web = await as(busyToken).post('/session', { prompt: 'one more' })
            expect(web.status).toBe(409)
            expect(web.body.message).toContain('(10)')
            expect(await prisma.session.count({ where: { userId: busyId } })).toBe(10)

            const search = await as(busyToken).post('/session', { type: 'SEARCH' })
            expect(search.status).toBe(201)
        })

        it('does not count stopped or failed sessions toward the limit', async () => {
            await prisma.session.updateMany({
                where: { userId: busyId, vmStatus: 'RUNNING' },
                data: { vmStatus: 'FAILED' },
            })
            const res = await as(busyToken).post('/session', { prompt: 'now there is room' })
            expect(res.status).toBe(201)
        })

        it('refuses a project id that does not exist (404), not a server error', async () => {
            const before = await prisma.session.count({ where: { userId: ownerId } })
            const res = await as(ownerToken).post('/session', {
                prompt: 'in a missing project',
                projectId: '00000000-0000-4000-8000-0000000000aa',
            })
            expect(res.status).toBe(404)
            expect(await prisma.session.count({ where: { userId: ownerId } })).toBe(before)
        })

        it("refuses to put a session in another user's project (404)", async () => {
            const project = await prisma.project.create({
                data: { userId: strangerId, name: 'their project' },
            })
            const res = await as(ownerToken).post('/session', {
                prompt: 'in their project',
                projectId: project.id,
            })
            expect(res.status).toBe(404)
            expect(await prisma.session.count({ where: { projectId: project.id } })).toBe(0)
        })

        it('puts a session in a project of the same user', async () => {
            const project = await prisma.project.create({
                data: { userId: ownerId, name: 'my project' },
            })
            const res = await as(ownerToken).post('/session', {
                prompt: 'in my project',
                projectId: project.id,
            })
            expect(res.status).toBe(201)
            expect(res.body.data.session.projectId).toBe(project.id)
        })
    })

    describe('GET /session/:id', () => {
        let sessionId: string
        let withFileId: string

        beforeAll(async () => {
            const session = await prisma.session.create({
                data: { userId: ownerId, title: 'Read me', tags: ['web'] },
            })
            sessionId = session.id
            // made out of order: the reply sorts them by sequence
            await prisma.message.createMany({
                data: [
                    { sessionId, role: 'ASSISTANT', content: 'second', sequence: 2 },
                    { sessionId, role: 'USER', content: 'first', sequence: 1 },
                    { sessionId, role: 'USER', content: 'third', sequence: 3, status: 'DONE' },
                ],
            })
            const first = await prisma.message.findFirstOrThrow({
                where: { sessionId, sequence: 1 },
            })
            withFileId = first.id
            await prisma.messageAttachment.createMany({
                data: [
                    {
                        sessionId,
                        messageId: withFileId,
                        name: 'design.png',
                        contentType: 'image/png',
                        sizeBytes: 1234,
                        fileKey: `attachments/${sessionId}/design.png`,
                    },
                    // not sent yet: it belongs to no message
                    {
                        sessionId,
                        name: 'draft.txt',
                        contentType: 'text/plain',
                        sizeBytes: 5,
                        fileKey: `attachments/${sessionId}/draft.txt`,
                    },
                ],
            })
        })

        it('returns the session, its configuration and its messages in order', async () => {
            const res = await as(ownerToken).get(`/session/${sessionId}`)
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            const { session, chatMessages, generatedFiles } = res.body.data
            expect(session.id).toBe(sessionId)
            expect(session.userId).toBe(ownerId)
            expect(session.title).toBe('Read me')
            expect(session.tags).toEqual(['web'])
            expect(session.config).toEqual(
                expect.objectContaining({
                    planFirst: expect.any(Boolean),
                    openPullRequest: expect.any(Boolean),
                })
            )
            expect(generatedFiles).toEqual({})
            expect(chatMessages.map((m: any) => m.sequence)).toEqual([1, 2, 3])
            expect(chatMessages.map((m: any) => m.content)).toEqual(['first', 'second', 'third'])
            expect(chatMessages.map((m: any) => m.role)).toEqual(['USER', 'ASSISTANT', 'USER'])
            expect(chatMessages[2].status).toBe('DONE')
        })

        it('puts sent files on their message only, and leaves unsent files out', async () => {
            const res = await as(ownerToken).get(`/session/${sessionId}`)
            const [first, second] = res.body.data.chatMessages
            expect(first.id).toBe(withFileId)
            expect(first.attachments).toHaveLength(1)
            expect(first.attachments[0]).toEqual(
                expect.objectContaining({
                    name: 'design.png',
                    contentType: 'image/png',
                    sizeBytes: 1234,
                })
            )
            // the file store key stays on the server
            expect(first.attachments[0].fileKey).toBeUndefined()
            expect(second.attachments).toBeUndefined()
            expect(JSON.stringify(res.body)).not.toContain('draft.txt')
        })

        it('returns a session with no messages', async () => {
            const empty = await prisma.session.create({ data: { userId: ownerId, title: 'Empty' } })
            const res = await as(ownerToken).get(`/session/${empty.id}`)
            expect(res.status).toBe(200)
            expect(res.body.data.chatMessages).toEqual([])
        })

        it('answers 404 for a deleted session', async () => {
            const gone = await prisma.session.create({ data: { userId: ownerId, title: 'Gone' } })
            await prisma.session.delete({ where: { id: gone.id } })
            const res = await as(ownerToken).get(`/session/${gone.id}`)
            expect(res.status).toBe(404)
        })

        it('answers 404 to a signed-in user who owns sessions too', async () => {
            await prisma.session.create({ data: { userId: strangerId, title: 'Stranger own' } })
            const res = await as(strangerToken).get(`/session/${sessionId}`)
            expect(res.status).toBe(404)
            expect(JSON.stringify(res.body)).not.toContain('Read me')
        })
    })

    describe('GET /session/:id/messages', () => {
        let sessionId: string
        const seqs = (res: request.Response) => res.body.data.messages.map((m: any) => m.sequence)

        beforeAll(async () => {
            const session = await prisma.session.create({
                data: { userId: ownerId, title: 'Long chat' },
            })
            sessionId = session.id
            await prisma.message.createMany({
                data: Array.from({ length: 60 }, (_, index) => ({
                    sessionId,
                    role: index % 2 === 0 ? ('USER' as const) : ('ASSISTANT' as const),
                    content: `message ${index + 1}`,
                    sequence: index + 1,
                })),
            })
            const withFile = await prisma.message.findFirstOrThrow({
                where: { sessionId, sequence: 59 },
            })
            await prisma.messageAttachment.create({
                data: {
                    sessionId,
                    messageId: withFile.id,
                    name: 'notes.md',
                    contentType: 'text/markdown',
                    sizeBytes: 10,
                    fileKey: `attachments/${sessionId}/notes.md`,
                },
            })
        })

        it('returns the newest 50 by default, oldest first', async () => {
            const res = await as(ownerToken).get(`/session/${sessionId}/messages`)
            expect(res.status).toBe(200)
            const got = seqs(res)
            expect(got).toHaveLength(50)
            expect(got[0]).toBe(11)
            expect(got[49]).toBe(60)
            expect(got).toEqual([...got].sort((a: number, b: number) => a - b))
        })

        it('takes an empty limit as the default', async () => {
            const res = await as(ownerToken).get(`/session/${sessionId}/messages?limit=`)
            expect(res.status).toBe(200)
            expect(seqs(res)).toHaveLength(50)
        })

        it('returns the newest messages up to the limit', async () => {
            const res = await as(ownerToken).get(`/session/${sessionId}/messages?limit=5`)
            expect(res.status).toBe(200)
            expect(seqs(res)).toEqual([56, 57, 58, 59, 60])
        })

        it('pages back with beforeSequence', async () => {
            const res = await as(ownerToken).get(
                `/session/${sessionId}/messages?beforeSequence=20&limit=5`
            )
            expect(res.status).toBe(200)
            expect(seqs(res)).toEqual([15, 16, 17, 18, 19])
        })

        it('pages with no gap and no repeat to the first message', async () => {
            const seen: number[] = []
            let before: number | undefined
            for (let page = 0; page < 10; page++) {
                const query =
                    before === undefined ? 'limit=25' : `limit=25&beforeSequence=${before}`
                const res = await as(ownerToken).get(`/session/${sessionId}/messages?${query}`)
                expect(res.status).toBe(200)
                const got: number[] = seqs(res)
                if (got.length === 0) break
                seen.unshift(...got)
                before = got[0]
            }
            expect(seen).toEqual(Array.from({ length: 60 }, (_, i) => i + 1))
        })

        it('returns nothing before the first message', async () => {
            for (const before of [0, 1]) {
                const res = await as(ownerToken).get(
                    `/session/${sessionId}/messages?beforeSequence=${before}`
                )
                expect(res.status).toBe(200)
                expect(res.body.data.messages).toEqual([])
            }
        })

        it('takes a limit of 100', async () => {
            const res = await as(ownerToken).get(`/session/${sessionId}/messages?limit=100`)
            expect(res.status).toBe(200)
            expect(seqs(res)).toHaveLength(60)
        })

        it('puts the sent files on their message', async () => {
            const res = await as(ownerToken).get(`/session/${sessionId}/messages?limit=3`)
            const byseq = Object.fromEntries(
                res.body.data.messages.map((m: any) => [m.sequence, m])
            )
            expect(byseq[59].attachments).toEqual([
                expect.objectContaining({ name: 'notes.md', sizeBytes: 10 }),
            ])
            expect(byseq[58].attachments).toBeUndefined()
            expect(byseq[60].attachments).toBeUndefined()
        })

        it('returns an empty list for a session with no messages', async () => {
            const empty = await prisma.session.create({
                data: { userId: ownerId, title: 'Quiet' },
            })
            const res = await as(ownerToken).get(`/session/${empty.id}/messages`)
            expect(res.status).toBe(200)
            expect(res.body.data.messages).toEqual([])
        })

        const badQueries = [
            'limit=0',
            'limit=101',
            'limit=-5',
            'limit=abc',
            'limit=2.5',
            'beforeSequence=-1',
            'beforeSequence=abc',
            'beforeSequence=1.5',
        ]
        for (const query of badQueries) {
            it(`refuses ${query} (400)`, async () => {
                const res = await as(ownerToken).get(`/session/${sessionId}/messages?${query}`)
                expect(res.status).toBe(400)
                expect(res.body.message).toBe('validation failed')
            })
        }

        it('checks the id before the query', async () => {
            const res = await as(ownerToken).get('/session/nope/messages?limit=0')
            expect(res.status).toBe(400)
            expect(res.body.errors.id).toBeDefined()
        })
    })

    describe('GET /session/:id/files and /file', () => {
        let otherId: string
        let filesId: string

        beforeAll(async () => {
            const files = await prisma.session.create({ data: { userId: ownerId, title: 'Files' } })
            filesId = files.id
            storedSessionIds.push(filesId)
            await putTextFile({ key: sessionWorkspaceKey(filesId, 'README.md'), content: '# hi' })
            await putTextFile({
                key: sessionWorkspaceKey(filesId, 'src/app/index.ts'),
                content: 'console.log(1)',
            })
            await putTextFile({
                key: sessionWorkspaceKey(filesId, 'bin/tool'),
                content: 'abc\u0000def',
            })
            await putTextFile({
                key: sessionWorkspaceKey(filesId, 'big.txt'),
                content: 'a'.repeat(1_000_010),
            })

            // another user's session, whose file must stay out of reach
            const other = await prisma.session.create({
                data: { userId: strangerId, title: 'Other files' },
            })
            otherId = other.id
            storedSessionIds.push(otherId)
            await putTextFile({
                key: sessionWorkspaceKey(otherId, 'private.txt'),
                content: `stranger ${SECRET}`,
            })
        })

        it("lists every file of the session's workspace and nothing else", async () => {
            const res = await as(ownerToken).get(`/session/${filesId}/files`)
            expect(res.status).toBe(200)
            expect([...res.body.data.files].sort()).toEqual(
                ['README.md', 'big.txt', 'bin/tool', 'src/app/index.ts'].sort()
            )
        })

        it('lists no files for a session with none', async () => {
            const empty = await prisma.session.create({ data: { userId: ownerId, title: 'None' } })
            const res = await as(ownerToken).get(`/session/${empty.id}/files`)
            expect(res.status).toBe(200)
            expect(res.body.data.files).toEqual([])
        })

        it('returns the text of a file', async () => {
            const res = await as(ownerToken).get(`/session/${filesId}/file?path=src/app/index.ts`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                path: 'src/app/index.ts',
                content: 'console.log(1)',
                binary: false,
                truncated: false,
                size: 14,
            })
        })

        it('drops the leading slashes of a path', async () => {
            const res = await as(ownerToken).get(`/session/${filesId}/file?path=///README.md`)
            expect(res.status).toBe(200)
            expect(res.body.data.path).toBe('README.md')
            expect(res.body.data.content).toBe('# hi')
        })

        it('does not show a binary file', async () => {
            const res = await as(ownerToken).get(`/session/${filesId}/file?path=bin/tool`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual(
                expect.objectContaining({ binary: true, content: '', truncated: false })
            )
        })

        it('cuts a file over a million characters', async () => {
            const res = await as(ownerToken).get(`/session/${filesId}/file?path=big.txt`)
            expect(res.status).toBe(200)
            expect(res.body.data.truncated).toBe(true)
            expect(res.body.data.content).toHaveLength(1_000_000)
            expect(res.body.data.size).toBe(1_000_010)
        })

        it('returns empty text for a missing file', async () => {
            const res = await as(ownerToken).get(`/session/${filesId}/file?path=nope.txt`)
            expect(res.status).toBe(200)
            expect(res.body.data.content).toBe('')
            expect(res.body.data.binary).toBe(false)
        })

        for (const path of [
            `../${'x'}/../../${'OTHER'}/workspace/private.txt`,
            '../../OTHER/workspace/private.txt',
            '..\\..\\OTHER\\workspace\\private.txt',
            '....//....//OTHER/workspace/private.txt',
            '/../../../sessions/OTHER/workspace/private.txt',
        ]) {
            it(`does not leave the session with a path like ${path}`, async () => {
                const res = await as(ownerToken)
                    .get(`/session/${filesId}/file`)
                    .query({ path: path.replace(/OTHER/g, otherId) })
                expect(res.status).toBe(200)
                expect(res.body.data.content).toBe('')
                expect(JSON.stringify(res.body)).not.toContain(SECRET)
            })
        }

        it('refuses a missing or empty path (400)', async () => {
            for (const query of ['', '?path=']) {
                const res = await as(ownerToken).get(`/session/${filesId}/file${query}`)
                expect(res.status).toBe(400)
                expect(res.body.errors.path).toBeDefined()
            }
        })

        it('refuses a path sent twice (400), not a server error', async () => {
            const res = await as(ownerToken).get(`/session/${filesId}/file?path=a&path=b`)
            expect(res.status).toBe(400)
        })

        it("never lists another user's files", async () => {
            const res = await as(ownerToken).get(`/session/${otherId}/files`)
            expect(res.status).toBe(404)
            expectNoLeak(res)
        })
    })

    describe('the views that read the run state', () => {
        // in tests the server has no run cache, so each view shows its empty state

        it('diff is empty', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/diff`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ gitStatus: '', gitDiff: '' })
        })

        it('plan is null', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/plan`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ plan: null })
        })

        it('tests are null', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/tests`)
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data).toBeNull()
        })

        it('desktop viewport is null', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/desktop-viewport`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ viewport: null })
        })

        it('pull request is null for a session with none', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/pull-requests`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ pullRequest: null })
        })

        it('pull request falls back to the pull request saved on the session', async () => {
            const openedAt = new Date('2026-10-01T09:00:00Z')
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'Has a pull request',
                    branch: 'main',
                    prNumber: 21,
                    prUrl: 'https://github.com/acme/web/pull/21',
                    prState: 'merged',
                    prTitle: 'Add dark mode',
                    prBranch: 'december/dark-mode',
                    prAdditions: 40,
                    prDeletions: 3,
                    prOpenedAt: openedAt,
                },
            })
            storedSessionIds.push(session.id)

            const res = await as(ownerToken).get(`/session/${session.id}/pull-requests`)

            expect(res.status).toBe(200)
            // only what was saved: no made-up base branch or checks
            expect(res.body.data.pullRequest).toEqual({
                prNumber: 21,
                url: 'https://github.com/acme/web/pull/21',
                title: 'Add dark mode',
                state: 'merged',
                headRef: 'december/dark-mode',
                diffSummary: { additions: 40, deletions: 3 },
                createdAt: openedAt.toISOString(),
            })
        })

        it('pull request is null for a session that opened none', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/pull-requests`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ pullRequest: null })
        })

        it('pending question is null when the agent asks nothing', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/pending-question`)
            expect(res.status).toBe(200)
            expect(res.body.data).toBeNull()
        })

        it('pending question is the spend limit question while one is open', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'At the limit',
                    limitQuestionKind: 'session',
                    limitQuestionCents: 500,
                    pendingQuestionAt: new Date(),
                },
            })
            const res = await as(ownerToken).get(`/session/${session.id}/pending-question`)
            expect(res.status).toBe(200)
            const question = res.body.data
            expect(question.type).toBe('AskQuestionPrompt')
            expect(question.source).toBe('spend-limit')
            expect(question.kind).toBe('session')
            expect(question.sessionId).toBe(session.id)
            expect(question.questionId).toBe('spend-limit:session')
            expect(question.questions).toHaveLength(1)
            expect(question.questions[0].question).toContain('$5')
            expect(question.questions[0].options).toHaveLength(2)
        })

        it('pending question is the day limit question for a day limit', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'At the day limit',
                    limitQuestionKind: 'day',
                    limitQuestionCents: 2000,
                },
            })
            const res = await as(ownerToken).get(`/session/${session.id}/pending-question`)
            expect(res.status).toBe(200)
            expect(res.body.data.questionId).toBe('spend-limit:day')
            expect(res.body.data.kind).toBe('day')
        })

        it('pending question is null when a limit kind has no amount', async () => {
            const session = await prisma.session.create({
                data: { userId: ownerId, title: 'Half saved', limitQuestionKind: 'session' },
            })
            const res = await as(ownerToken).get(`/session/${session.id}/pending-question`)
            expect(res.status).toBe(200)
            expect(res.body.data).toBeNull()
        })

        it('another user cannot read the spend limit question', async () => {
            const session = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: `Limit ${SECRET}`,
                    limitQuestionKind: 'session',
                    limitQuestionCents: 500,
                },
            })
            const res = await as(strangerToken).get(`/session/${session.id}/pending-question`)
            expect(res.status).toBe(404)
            expectNoLeak(res)
        })
    })

    describe('GET /session/:id/preview-port', () => {
        it('has no port when nothing listens', async () => {
            const res = await as(ownerToken).get(`/session/${mainId}/preview-port`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                sessionId: mainId,
                port: null,
                ports: [],
                previewUrl: null,
            })
        })

        it('points a listening port at the e2b sandbox', async () => {
            const session = await prisma.session.create({
                data: { userId: ownerId, title: 'Preview', vmId: `sbx${stamp}` },
            })
            runtimeService.setSessionListeningPort({ sessionId: session.id, port: 5173 })
            const res = await as(ownerToken).get(`/session/${session.id}/preview-port`)
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                sessionId: session.id,
                port: 5173,
                ports: [],
                previewUrl: `https://5173-sbx${stamp}.e2b.dev/`,
            })
        })

        it('uses the december preview host for a session with no sandbox or a mock one', async () => {
            for (const vmId of [null, 'mock-123']) {
                const session = await prisma.session.create({
                    data: { userId: ownerId, title: 'Preview mock', vmId },
                })
                runtimeService.setSessionListeningPort({ sessionId: session.id, port: 3000 })
                const res = await as(ownerToken).get(`/session/${session.id}/preview-port`)
                expect(res.status).toBe(200)
                expect(res.body.data.previewUrl).toBe(
                    `https://session-${session.id}-3000.preview.trydecember.com/`
                )
            }
        })

        it('does not give another user the port of a session', async () => {
            runtimeService.setSessionListeningPort({ sessionId: mainId, port: 4321 })
            const res = await as(strangerToken).get(`/session/${mainId}/preview-port`)
            expect(res.status).toBe(404)
            expect(JSON.stringify(res.body)).not.toContain('4321')
            expect(JSON.stringify(res.body)).not.toContain(`vm-detail-${stamp}`)
        })
    })

    describe('GET /session/sandboxes', () => {
        it('needs a sign-in (401)', async () => {
            const res = await as().get('/session/sandboxes')
            expect(res.status).toBe(401)
        })

        it("is not read as a session id and never lists another user's sandbox", async () => {
            const running = await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: `Running ${SECRET}`,
                    vmId: `vm-run-${stamp}`,
                    sandboxStatus: 'RUNNING',
                },
            })
            const res = await as(strangerToken).get('/session/sandboxes')
            expect(res.status).toBe(200)
            expect(res.body.data.items.map((item: any) => item.sessionId)).not.toContain(running.id)
            expect(JSON.stringify(res.body)).not.toContain(SECRET)

            const own = await as(ownerToken).get('/session/sandboxes')
            expect(own.status).toBe(200)
            const item = own.body.data.items.find((row: any) => row.sessionId === running.id)
            expect(item).toEqual(
                expect.objectContaining({
                    sandboxStatus: 'RUNNING',
                    costInCents: 0,
                    repoFullName: null,
                })
            )
            // the paused main session is not running
            expect(own.body.data.items.map((row: any) => row.sessionId)).not.toContain(mainId)
        })
    })
})
