import { prisma } from '@december/database'
import { encryptText } from '@december/shared/crypto'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// issue 637 section 6: read a repository for skills, mcp servers and rules files, show
// what was found, and import the names the user ticks. github is a stand-in: a map of
// file paths to text for each repository, and the token that can read it.

type FakeRepo = { token: string; files: Record<string, string> }

const SECRET_HEADER_VALUE = 'Bearer sk-live-do-not-leak'

const skillFile = (name: string, description: string, body = `steps of ${name}`) =>
    `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`

describe('Connections: import setup from a repository (#637)', () => {
    const stamp = Date.now()
    const ownerEmail = `conn-import-owner-${stamp}@example.com`
    const otherEmail = `conn-import-other-${stamp}@example.com`
    const OWNER_GH_TOKEN = `gh-import-owner-${stamp}`
    const OTHER_GH_TOKEN = `gh-import-other-${stamp}`

    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    let repos: Record<string, FakeRepo> = {}
    let githubCalls: string[] = []
    const realFetch = globalThis.fetch

    const githubJson = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })

    /** the contents api of github for the repositories in `repos` */
    const fakeGithub = (async (input: any, init?: RequestInit) => {
        const url = String(input)
        if (!url.startsWith('https://api.github.com')) return realFetch(input, init)
        githubCalls.push(url)

        const match = new URL(url).pathname.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/(.*)$/)
        const repo = match ? repos[match[1] as string] : undefined
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
        // github answers 404 for a repository the token cannot read
        if (!match || !repo || auth !== `Bearer ${repo.token}`) {
            return githubJson({ message: 'Not Found' }, 404)
        }

        const path = decodeURIComponent(match[2] as string).replace(/\/+$/, '')
        const text = repo.files[path]
        if (text !== undefined) {
            return githubJson({
                type: 'file',
                name: path.split('/').pop(),
                path,
                size: Buffer.byteLength(text),
                encoding: 'base64',
                content: Buffer.from(text).toString('base64'),
            })
        }

        const prefix = path ? `${path}/` : ''
        const children = new Map<string, 'file' | 'dir'>()
        for (const filePath of Object.keys(repo.files)) {
            if (!filePath.startsWith(prefix)) continue
            const [name, ...rest] = filePath.slice(prefix.length).split('/')
            children.set(name as string, rest.length > 0 ? 'dir' : 'file')
        }
        if (children.size === 0) return githubJson({ message: 'Not Found' }, 404)
        return githubJson(
            [...children].map(([name, type]) => ({ name, path: `${prefix}${name}`, type }))
        )
    }) as typeof fetch

    const post = (token: string, path: string, body: object) =>
        request(app)
            .post(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body)

    const preview = (token: string, repoFullName: string) =>
        post(token, '/connections/import/preview', { repoFullName })

    const importSetup = (token: string, body: Record<string, unknown>) =>
        post(token, '/connections/import', body)

    const byName = <T extends { name: string }>(rows: T[], name: string) =>
        rows.find((row) => row.name === name)

    beforeAll(async () => {
        const owner = await createSignedInUser({ email: ownerEmail, name: 'Import Owner' })
        ownerId = owner.userId
        ownerToken = owner.token
        const other = await createSignedInUser({ email: otherEmail, name: 'Import Other' })
        otherId = other.userId
        otherToken = other.token
        await prisma.user.update({ where: { id: ownerId }, data: { githubToken: OWNER_GH_TOKEN } })
        await prisma.user.update({ where: { id: otherId }, data: { githubToken: OTHER_GH_TOKEN } })
        globalThis.fetch = fakeGithub
    })

    beforeEach(async () => {
        const userId = { in: [ownerId, otherId] }
        await prisma.userSkill.deleteMany({ where: { userId } })
        await prisma.userMcpServer.deleteMany({ where: { userId } })
        await prisma.userRule.deleteMany({ where: { userId } })
        githubCalls = []
        repos = {
            'acme/app': {
                token: OWNER_GH_TOKEN,
                files: {
                    'README.md': '# app',
                    'AGENTS.md': 'use bun',
                    'CLAUDE.md': 'see AGENTS.md',
                    '.december/skills/deploy/SKILL.md': skillFile('deploy', 'ship the app'),
                    '.december/skills/deploy/scripts/run.sh': 'echo hi',
                    '.claude/skills/release-notes/SKILL.md': skillFile(
                        'release-notes',
                        'write the release notes'
                    ),
                    '.agents/skills/lowercase/skill.md': skillFile('lowercase', 'a small file'),
                    '.december/mcp.json': JSON.stringify({
                        mcpServers: {
                            linear: {
                                url: 'https://mcp.linear.app/mcp',
                                transport: 'http',
                                headers: { Authorization: SECRET_HEADER_VALUE, 'X-Team': 'acme' },
                            },
                            docs: { url: 'https://docs.example.com/sse' },
                            files: {
                                command: 'npx',
                                args: ['-y', 'files-server'],
                                env: { FILES_KEY: 'sk-env-do-not-leak' },
                            },
                            intranet: { url: 'https://10.0.0.8/mcp' },
                            plain: { url: 'http://mcp.example.com/mcp' },
                        },
                    }),
                },
            },
        }
    })

    afterAll(async () => {
        globalThis.fetch = realFetch
        await cleanupTestUser({ id: ownerId })
        await cleanupTestUser({ id: otherId })
    })

    describe('preview', () => {
        it('needs a signed-in user', async () => {
            const res = await request(app)
                .post('/api/v1/connections/import/preview')
                .set('x-forwarded-for', getRandomIP())
                .send({ repoFullName: 'acme/app' })
            expect(res.status).toBe(401)
        })

        it('finds the skills, mcp servers and rules files of a repository', async () => {
            const res = await preview(ownerToken, 'acme/app')

            expect(res.status).toBe(200)
            expect(res.body.data.skills).toEqual([
                {
                    name: 'deploy',
                    description: 'ship the app',
                    path: '.december/skills/deploy/SKILL.md',
                    exists: false,
                    importable: true,
                },
                {
                    name: 'lowercase',
                    description: 'a small file',
                    path: '.agents/skills/lowercase/skill.md',
                    exists: false,
                    importable: true,
                },
                {
                    name: 'release-notes',
                    description: 'write the release notes',
                    path: '.claude/skills/release-notes/SKILL.md',
                    exists: false,
                    importable: true,
                },
            ])
            expect(byName(res.body.data.mcps, 'linear')).toEqual({
                name: 'linear',
                url: 'https://mcp.linear.app/mcp',
                transport: 'http',
                headerNames: ['Authorization', 'X-Team'],
                exists: false,
                importable: true,
                note: 'Add the header values after the import.',
            })
            // the cli reads an entry with no transport as sse
            expect(byName(res.body.data.mcps, 'docs')).toEqual({
                name: 'docs',
                url: 'https://docs.example.com/sse',
                transport: 'sse',
                headerNames: [],
                exists: false,
                importable: true,
            })
            expect(res.body.data.rules).toEqual([
                { path: 'AGENTS.md', name: 'app-agents', exists: false, importable: true },
                { path: 'CLAUDE.md', name: 'app-claude', exists: false, importable: true },
            ])
            expect(res.body.data.truncated).toBe(false)
        })

        it('lists a server that runs a command or has a private url as not importable', async () => {
            const res = await preview(ownerToken, 'acme/app')

            expect(byName(res.body.data.mcps, 'files')).toEqual({
                name: 'files',
                url: null,
                transport: 'stdio',
                headerNames: [],
                exists: false,
                importable: false,
                reason: 'It runs a command. Only a server with a url can be imported.',
            })
            expect(byName(res.body.data.mcps, 'intranet')).toMatchObject({
                url: 'https://10.0.0.8/mcp',
                importable: false,
                reason: 'The server must be on a public address.',
            })
            expect(byName(res.body.data.mcps, 'plain')).toMatchObject({
                importable: false,
                reason: 'The url must start with https://.',
            })
        })

        it('never returns a header value, an env value or a password in a url', async () => {
            repos['acme/app']!.files['.december/mcp.json'] = JSON.stringify({
                mcpServers: {
                    linear: {
                        url: 'https://mcp.linear.app/mcp',
                        headers: { Authorization: SECRET_HEADER_VALUE },
                    },
                    files: { command: 'npx', env: { FILES_KEY: 'sk-env-do-not-leak' } },
                    basic: { url: 'https://jo:pw-do-not-leak@mcp.example.com/mcp' },
                },
            })

            const res = await preview(ownerToken, 'acme/app')

            expect(res.status).toBe(200)
            const text = JSON.stringify(res.body)
            expect(text).not.toContain('do-not-leak')
            expect(byName(res.body.data.mcps, 'linear').headerNames).toEqual(['Authorization'])
            expect(byName(res.body.data.mcps, 'basic')).toMatchObject({
                url: 'https://mcp.example.com/mcp',
                importable: false,
                reason: 'Put credentials in a header, not in the url.',
            })
        })

        it('marks the names the account has already', async () => {
            await prisma.userSkill.create({
                data: { userId: ownerId, name: 'deploy', description: 'mine', body: 'my steps' },
            })
            await prisma.userMcpServer.create({
                data: { userId: ownerId, name: 'linear', url: 'https://mcp.linear.app/mcp' },
            })
            // a name of another account does not count
            await prisma.userSkill.create({
                data: { userId: otherId, name: 'lowercase', description: 'x', body: 'y' },
            })

            const res = await preview(ownerToken, 'acme/app')

            expect(res.body.data.skills.map((row: any) => [row.name, row.exists])).toEqual([
                ['deploy', true],
                ['lowercase', false],
                ['release-notes', false],
            ])
            expect(byName(res.body.data.mcps, 'linear').exists).toBe(true)
            expect(byName(res.body.data.mcps, 'docs').exists).toBe(false)
        })

        it('answers 404 for a repository of another account', async () => {
            const res = await preview(otherToken, 'acme/app')
            expect(res.status).toBe(404)
            expect(res.body.data).toBeUndefined()

            const missing = await preview(ownerToken, 'acme/nothing-here')
            expect(missing.status).toBe(404)
        })

        it('refuses a repository name that is not owner/name', async () => {
            for (const repoFullName of ['app', 'acme/../user', 'acme/app/contents', 'acme/a b']) {
                const res = await preview(ownerToken, repoFullName)
                expect(res.status).toBe(400)
            }
            expect(githubCalls).toEqual([])
        })

        it('lists a skill file over 64 KB as not importable, with the reason', async () => {
            repos['acme/app']!.files['.december/skills/huge/SKILL.md'] = skillFile(
                'huge',
                'a very long skill',
                'x'.repeat(64 * 1024)
            )

            const res = await preview(ownerToken, 'acme/app')

            expect(byName(res.body.data.skills, 'huge')).toEqual({
                name: 'huge',
                description: '',
                path: '.december/skills/huge/SKILL.md',
                exists: false,
                importable: false,
                reason: 'The file is larger than 64 KB.',
            })
            expect(byName(res.body.data.skills, 'deploy').importable).toBe(true)
        })

        it('says why a skill file cannot be imported', async () => {
            const files = repos['acme/app']!.files
            files['.december/skills/no-top/SKILL.md'] = 'just some notes'
            files['.december/skills/bad_name/SKILL.md'] = skillFile('Bad_Name', 'underscores')
            files['.december/skills/long/SKILL.md'] = skillFile('long', 'long', 'y'.repeat(20_001))
            files['.december/skills/off/SKILL.md'] =
                '---\nname: off\ndescription: turned off\ndisable: true\n---\n\nsteps\n'

            const res = await preview(ownerToken, 'acme/app')
            const rows = res.body.data.skills

            expect(byName(rows, 'no-top')).toMatchObject({
                importable: false,
                reason: 'The file needs a name and a description at the top.',
            })
            expect(byName(rows, 'bad_name')).toMatchObject({
                importable: false,
                reason: 'A skill name has lowercase letters, numbers and dashes.',
            })
            expect(byName(rows, 'long')).toMatchObject({
                importable: false,
                reason: 'The instructions are longer than 20,000 characters.',
            })
            // a skill its file turns off is not listed, like in the cli
            expect(byName(rows, 'off')).toBeUndefined()
        })

        it('reads at most 50 skill files', async () => {
            const files: Record<string, string> = {}
            for (let i = 0; i < 60; i++) {
                const name = `skill-${String(i).padStart(2, '0')}`
                files[`.december/skills/${name}/SKILL.md`] = skillFile(name, `skill ${i}`)
            }
            repos['acme/many'] = { token: OWNER_GH_TOKEN, files }

            const res = await preview(ownerToken, 'acme/many')

            expect(res.status).toBe(200)
            expect(res.body.data.skills.length).toBe(50)
            expect(res.body.data.truncated).toBe(true)
            expect(githubCalls.filter((url) => url.endsWith('/SKILL.md')).length).toBe(50)
        })

        it('uses the skill of the december folder when two folders have the same name', async () => {
            repos['acme/app']!.files['.claude/skills/deploy/SKILL.md'] = skillFile(
                'deploy',
                'the claude one'
            )

            const res = await preview(ownerToken, 'acme/app')

            expect(byName(res.body.data.skills, 'deploy')).toMatchObject({
                description: 'ship the app',
                path: '.december/skills/deploy/SKILL.md',
            })
        })

        it('answers with empty lists for a repository with no setup', async () => {
            repos['acme/plain'] = { token: OWNER_GH_TOKEN, files: { 'README.md': '# plain' } }

            const res = await preview(ownerToken, 'acme/plain')

            expect(res.status).toBe(200)
            expect(res.body.data).toMatchObject({ skills: [], mcps: [], rules: [] })
            // only the root is read
            expect(githubCalls.length).toBe(1)
        })
    })

    describe('import', () => {
        const skillNames = async (userId: string) =>
            (await prisma.userSkill.findMany({ where: { userId }, orderBy: { name: 'asc' } })).map(
                (row) => row.name
            )
        const serverNames = async (userId: string) =>
            (
                await prisma.userMcpServer.findMany({ where: { userId }, orderBy: { name: 'asc' } })
            ).map((row) => row.name)

        it('saves only the ticked names', async () => {
            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: ['deploy'],
                mcps: ['linear'],
            })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                imported: { skills: ['deploy'], mcps: ['linear'], rules: [] },
                skipped: [],
            })
            expect(await skillNames(ownerId)).toEqual(['deploy'])
            expect(await serverNames(ownerId)).toEqual(['linear'])

            const skill = await prisma.userSkill.findFirst({ where: { userId: ownerId } })
            expect(skill).toMatchObject({
                name: 'deploy',
                description: 'ship the app',
                body: 'steps of deploy',
                runs: 'agent',
                enabled: true,
            })
        })

        it('saves an mcp server with no header values and the status unknown', async () => {
            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: [],
                mcps: ['linear', 'docs'],
            })
            expect(res.status).toBe(200)
            expect(JSON.stringify(res.body)).not.toContain('do-not-leak')

            const linear = await prisma.userMcpServer.findUnique({
                where: { userId_name: { userId: ownerId, name: 'linear' } },
            })
            expect(linear).toMatchObject({
                url: 'https://mcp.linear.app/mcp',
                transport: 'http',
                auth: 'none',
                encryptedHeaders: null,
                headerKeys: [],
                enabled: true,
                status: 'unknown',
                lastError: null,
                tools: [],
                checkedAt: null,
            })
            const docs = await prisma.userMcpServer.findUnique({
                where: { userId_name: { userId: ownerId, name: 'docs' } },
            })
            expect(docs).toMatchObject({ url: 'https://docs.example.com/sse', transport: 'sse' })

            // the saved rows show in the list of the page
            const list = await request(app)
                .get('/api/v1/connections/mcps')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${ownerToken}`)
            expect(list.body.data.mcps.map((row: any) => row.name)).toEqual(['docs', 'linear'])
        })

        it('reads the repository again and saves nothing the browser sends', async () => {
            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                // a browser cannot put its own text or address in
                skills: [{ name: 'deploy', body: 'run rm -rf' }],
                mcps: ['linear'],
                url: 'https://evil.example.com/mcp',
            })
            expect(res.status).toBe(400)
            expect(await skillNames(ownerId)).toEqual([])

            // a field the route does not know is refused (strict body)
            const extra = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: ['deploy'],
                mcps: ['linear'],
                url: 'https://evil.example.com/mcp',
                body: 'run rm -rf',
            })
            expect(extra.status).toBe(400)
            expect(await skillNames(ownerId)).toEqual([])

            const ok = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: ['deploy'],
                mcps: ['linear'],
            })
            expect(ok.status).toBe(200)
            const skill = await prisma.userSkill.findFirst({ where: { userId: ownerId } })
            expect(skill?.body).toBe('steps of deploy')
            const server = await prisma.userMcpServer.findFirst({ where: { userId: ownerId } })
            expect(server?.url).toBe('https://mcp.linear.app/mcp')
        })

        it('skips a name the account has already', async () => {
            await prisma.userSkill.create({
                data: { userId: ownerId, name: 'deploy', description: 'mine', body: 'my steps' },
            })
            await prisma.userMcpServer.create({
                data: { userId: ownerId, name: 'linear', url: 'https://my.example.com/mcp' },
            })

            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: ['deploy', 'release-notes'],
                mcps: ['linear', 'docs'],
            })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                imported: { skills: ['release-notes'], mcps: ['docs'], rules: [] },
                skipped: [
                    {
                        kind: 'skill',
                        name: 'deploy',
                        reason: 'A skill with this name exists already.',
                    },
                    {
                        kind: 'mcp',
                        name: 'linear',
                        reason: 'An mcp server with this name exists already.',
                    },
                ],
            })
            const mine = await prisma.userSkill.findUnique({
                where: { userId_name: { userId: ownerId, name: 'deploy' } },
            })
            expect(mine?.body).toBe('my steps')
            const server = await prisma.userMcpServer.findUnique({
                where: { userId_name: { userId: ownerId, name: 'linear' } },
            })
            expect(server?.url).toBe('https://my.example.com/mcp')
        })

        it('replaces a name the account has already when overwrite is set', async () => {
            await prisma.userSkill.create({
                data: {
                    userId: ownerId,
                    name: 'deploy',
                    description: 'mine',
                    body: 'my steps',
                    runs: 'user',
                    enabled: false,
                },
            })
            await prisma.userMcpServer.create({
                data: {
                    userId: ownerId,
                    name: 'linear',
                    url: 'https://my.example.com/mcp',
                    auth: 'header',
                    encryptedHeaders: 'saved-for-the-old-address',
                    headerKeys: ['Authorization'],
                    status: 'connected',
                    checkedAt: new Date(),
                },
            })

            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: ['deploy'],
                mcps: ['linear'],
                overwrite: true,
            })

            expect(res.body.data).toEqual({
                imported: { skills: ['deploy'], mcps: ['linear'], rules: [] },
                skipped: [],
            })
            const skill = await prisma.userSkill.findUnique({
                where: { userId_name: { userId: ownerId, name: 'deploy' } },
            })
            // the text is new, the user's switches stay
            expect(skill).toMatchObject({
                description: 'ship the app',
                body: 'steps of deploy',
                runs: 'user',
                enabled: false,
            })
            expect(await prisma.userSkill.count({ where: { userId: ownerId } })).toBe(1)

            // the saved header was for another address: it does not go to the new one
            const server = await prisma.userMcpServer.findUnique({
                where: { userId_name: { userId: ownerId, name: 'linear' } },
            })
            expect(server).toMatchObject({
                url: 'https://mcp.linear.app/mcp',
                auth: 'none',
                encryptedHeaders: null,
                headerKeys: [],
                status: 'unknown',
                checkedAt: null,
            })
        })

        it('skips what cannot be imported, with the reason', async () => {
            repos['acme/app']!.files['.december/skills/huge/SKILL.md'] = skillFile(
                'huge',
                'a very long skill',
                'x'.repeat(64 * 1024)
            )

            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: ['huge', 'not-there'],
                mcps: ['files', 'intranet'],
            })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                imported: { skills: [], mcps: [], rules: [] },
                skipped: [
                    { kind: 'skill', name: 'huge', reason: 'The file is larger than 64 KB.' },
                    { kind: 'skill', name: 'not-there', reason: 'It is not in the repository.' },
                    {
                        kind: 'mcp',
                        name: 'files',
                        reason: 'It runs a command. Only a server with a url can be imported.',
                    },
                    {
                        kind: 'mcp',
                        name: 'intranet',
                        reason: 'The server must be on a public address.',
                    },
                ],
            })
            expect(await skillNames(ownerId)).toEqual([])
            expect(await serverNames(ownerId)).toEqual([])
        })

        it('keeps the limit of 100 skills', async () => {
            await prisma.userSkill.createMany({
                data: Array.from({ length: 99 }, (_, i) => ({
                    userId: ownerId,
                    name: `mine-${i}`,
                    description: 'd',
                    body: 'b',
                })),
            })

            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: ['deploy', 'release-notes'],
                mcps: [],
            })

            expect(res.body.data).toEqual({
                imported: { skills: ['deploy'], mcps: [], rules: [] },
                skipped: [
                    {
                        kind: 'skill',
                        name: 'release-notes',
                        reason: 'You can save up to 100 skills.',
                    },
                ],
            })
            expect(await prisma.userSkill.count({ where: { userId: ownerId } })).toBe(100)
        })

        it('keeps the limit of 20 mcp servers', async () => {
            await prisma.userMcpServer.createMany({
                data: Array.from({ length: 19 }, (_, i) => ({
                    userId: ownerId,
                    name: `mine-${i}`,
                    url: 'https://mcp.example.com/mcp',
                })),
            })

            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                skills: [],
                mcps: ['linear', 'docs'],
            })

            expect(res.body.data).toEqual({
                imported: { skills: [], mcps: ['linear'], rules: [] },
                skipped: [
                    { kind: 'mcp', name: 'docs', reason: 'You can save up to 20 mcp servers.' },
                ],
            })
            expect(await prisma.userMcpServer.count({ where: { userId: ownerId } })).toBe(20)
        })

        it('answers 404 for a repository of another account and saves nothing', async () => {
            const res = await importSetup(otherToken, {
                repoFullName: 'acme/app',
                skills: ['deploy'],
                mcps: ['linear'],
            })
            expect(res.status).toBe(404)
            expect(await skillNames(otherId)).toEqual([])
            expect(await serverNames(otherId)).toEqual([])
        })

        it('needs a signed-in user', async () => {
            const res = await request(app)
                .post('/api/v1/connections/import')
                .set('x-forwarded-for', getRandomIP())
                .send({ repoFullName: 'acme/app', skills: ['deploy'], mcps: [] })
            expect(res.status).toBe(401)
        })
    })

    it('asks for the gitlab connection when the repository is on gitlab', async () => {
        // no gitlab connection: the request stops before any host is asked
        const res = await post(ownerToken, '/connections/import/preview', {
            repoFullName: 'acme/tools/app',
            provider: 'GITLAB',
        })
        // not 401: that status is for the december sign-in
        expect(res.status).toBe(400)
        expect(res.body.message).toBe('gitlab is not connected')
        expect(githubCalls).toEqual([])
    })

    it('reads a gitlab project with the gitlab token of the user', async () => {
        const GITLAB_TOKEN = `gl-import-${stamp}`
        await prisma.gitConnection.create({
            data: {
                userId: ownerId,
                provider: 'GITLAB',
                externalId: `gl-import-${stamp}`,
                username: 'import-owner',
                encryptedAccessToken: encryptText({
                    text: GITLAB_TOKEN,
                    keyHex: env.SECRETS_ENC_KEY,
                }),
            },
        })
        const project = 'https://gitlab.com/api/v4/projects/acme%2Ftools%2Fapp/repository'
        const gitlabCalls: string[] = []
        globalThis.fetch = (async (input: any, init?: RequestInit) => {
            const url = String(input)
            if (!url.startsWith('https://gitlab.com')) return fakeGithub(input, init)
            gitlabCalls.push(url)
            const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
            if (auth !== `Bearer ${GITLAB_TOKEN}`) return githubJson({ message: '401' }, 401)
            const { pathname, searchParams } = new URL(url)
            const tree = searchParams.get('path')
            if (pathname.endsWith('/repository/tree') && tree === null) {
                return githubJson([
                    { name: '.december', path: '.december', type: 'tree' },
                    { name: 'AGENTS.md', path: 'AGENTS.md', type: 'blob' },
                ])
            }
            if (pathname.endsWith('/repository/tree') && tree === '.december/skills') {
                return githubJson([
                    { name: 'deploy', path: '.december/skills/deploy', type: 'tree' },
                ])
            }
            if (url === `${project}/files/.december%2Fskills%2Fdeploy%2FSKILL.md?ref=HEAD`) {
                const text = skillFile('deploy', 'ship the app')
                return githubJson({
                    size: Buffer.byteLength(text),
                    encoding: 'base64',
                    content: Buffer.from(text).toString('base64'),
                })
            }
            return githubJson({ message: '404 Not Found' }, 404)
        }) as typeof fetch

        try {
            const res = await post(ownerToken, '/connections/import', {
                repoFullName: 'acme/tools/app',
                provider: 'GITLAB',
                skills: ['deploy'],
                mcps: [],
            })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                imported: { skills: ['deploy'], mcps: [], rules: [] },
                skipped: [],
            })
            const skill = await prisma.userSkill.findFirst({ where: { userId: ownerId } })
            expect(skill).toMatchObject({ name: 'deploy', body: 'steps of deploy' })
            expect(gitlabCalls.length).toBeGreaterThan(0)
            expect(githubCalls).toEqual([])
        } finally {
            globalThis.fetch = fakeGithub
            await prisma.gitConnection.deleteMany({ where: { userId: ownerId } })
        }
    })

    // rule files at the root become account rules (connections, rules tab)
    describe('rule files', () => {
        const ruleRows = async (userId: string) =>
            prisma.userRule.findMany({ where: { userId }, orderBy: { name: 'asc' } })

        it('imports a ticked rule file as an account rule named after the repository', async () => {
            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                rules: ['AGENTS.md'],
            })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                imported: { skills: [], mcps: [], rules: ['app-agents'] },
                skipped: [],
            })
            const rows = await ruleRows(ownerId)
            expect(rows.map((row) => [row.name, row.body, row.enabled])).toEqual([
                ['app-agents', 'use bun', true],
            ])
            // the preview now says the rule is saved
            const again = await preview(ownerToken, 'acme/app')
            expect(again.body.data.rules[0]).toMatchObject({ name: 'app-agents', exists: true })
        })

        it('skips a saved rule unless overwrite is set, then replaces its text', async () => {
            await prisma.userRule.create({
                data: { userId: ownerId, name: 'app-agents', body: 'mine', enabled: false },
            })
            const skipped = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                rules: ['AGENTS.md'],
            })
            expect(skipped.body.data.skipped).toEqual([
                {
                    kind: 'rule',
                    name: 'app-agents',
                    reason: 'A rule with this name exists already.',
                },
            ])
            expect((await ruleRows(ownerId))[0]?.body).toBe('mine')

            const replaced = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                rules: ['AGENTS.md'],
                overwrite: true,
            })
            expect(replaced.body.data.imported.rules).toEqual(['app-agents'])
            const row = (await ruleRows(ownerId))[0]
            // the text changes, the switch the user set stays
            expect(row).toMatchObject({ body: 'use bun', enabled: false })
        })

        it('refuses a path that is not a rule file, and skips one the repository does not have', async () => {
            const bad = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                rules: ['.env'],
            })
            expect(bad.status).toBe(400)

            delete repos['acme/app']?.files['CLAUDE.md']
            const missing = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                rules: ['CLAUDE.md'],
            })
            expect(missing.status).toBe(200)
            expect(missing.body.data.skipped).toEqual([
                { kind: 'rule', name: 'CLAUDE.md', reason: 'It is not in the repository.' },
            ])
            expect(await ruleRows(ownerId)).toEqual([])
        })

        it('skips a rule file over 16 KiB and an empty one', async () => {
            const files = repos['acme/app']?.files as Record<string, string>
            files['AGENTS.md'] = 'x'.repeat(16 * 1024 + 1)
            files['CLAUDE.md'] = '   \n'
            const found = await preview(ownerToken, 'acme/app')
            expect(found.body.data.rules).toEqual([
                {
                    path: 'AGENTS.md',
                    name: 'app-agents',
                    exists: false,
                    importable: false,
                    reason: 'The file is larger than 16 KiB.',
                },
                {
                    path: 'CLAUDE.md',
                    name: 'app-claude',
                    exists: false,
                    importable: false,
                    reason: 'The file is empty.',
                },
            ])
            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                rules: ['AGENTS.md', 'CLAUDE.md'],
            })
            expect(res.body.data.imported.rules).toEqual([])
            expect(res.body.data.skipped.map((row: any) => row.reason)).toEqual([
                'The file is larger than 16 KiB.',
                'The file is empty.',
            ])
        })

        it('keeps the 32 KiB limit of all rules together', async () => {
            await prisma.userRule.createMany({
                data: [
                    { userId: ownerId, name: 'big-1', body: 'a'.repeat(16 * 1024) },
                    { userId: ownerId, name: 'big-2', body: 'b'.repeat(16 * 1024 - 3) },
                ],
            })
            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                rules: ['AGENTS.md'],
            })
            expect(res.body.data.skipped).toEqual([
                {
                    kind: 'rule',
                    name: 'app-agents',
                    reason: 'All rules together can be up to 32 KiB.',
                },
            ])
        })

        it('keeps the limit of 20 rules', async () => {
            await prisma.userRule.createMany({
                data: Array.from({ length: 20 }, (_, i) => ({
                    userId: ownerId,
                    name: `rule-${i}`,
                    body: 'x',
                })),
            })
            const res = await importSetup(ownerToken, {
                repoFullName: 'acme/app',
                rules: ['AGENTS.md'],
            })
            expect(res.body.data.skipped).toEqual([
                { kind: 'rule', name: 'app-agents', reason: 'You can save up to 20 rules.' },
            ])
        })

        it("never reads another user's repository", async () => {
            const res = await importSetup(otherToken, {
                repoFullName: 'acme/app',
                rules: ['AGENTS.md'],
            })
            expect(res.status).toBe(404)
            expect(await ruleRows(otherId)).toEqual([])
        })
    })
})
