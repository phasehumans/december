import { gunzipSync } from 'node:zlib'

import { prisma } from '@december/database'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { pluginGithub } from '../../src/modules/plugin/plugin.github'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'
import { makeRepoArchive } from '../support/plugin-archive'

import type { GithubPluginSource } from '../../src/modules/plugin/plugin.types'

// connections page, plugins: install from the built-in marketplace or a public github
// repository, list, turn on and off, update, uninstall. github is never called: the
// download is replaced with archives built here
describe('Connections: plugins', () => {
    const stamp = Date.now()
    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    const call = (token: string | null, method: 'get' | 'post' | 'patch' | 'delete') => {
        return (path: string, body?: object) => {
            let req = request(app)
                [method](`/api/v1/connections/plugins${path}`)
                .set('x-forwarded-for', getRandomIP())
            if (token) req = req.set('Authorization', `Bearer ${token}`)
            return body === undefined ? req : req.send(body)
        }
    }
    const as = (token: string | null) => ({
        get: call(token, 'get'),
        post: call(token, 'post'),
        patch: call(token, 'patch'),
        delete: call(token, 'delete'),
    })

    const releasePlugin = (version = '1.0.0') =>
        makeRepoArchive(
            {
                'plugin.json': JSON.stringify({
                    name: 'release',
                    version,
                    description: 'Ships releases',
                }),
                'skills/ship/SKILL.md':
                    '---\nname: ship\ndescription: ship it\n---\nrun ${CLAUDE_PLUGIN_ROOT}/bin/ship.sh',
                'bin/ship.sh': { data: '#!/bin/sh\necho ship', mode: 0o755 },
                'mcp.json': JSON.stringify({
                    mcpServers: {
                        notes: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server.js'] },
                        docs: { url: 'https://docs.example.com/mcp', type: 'http' },
                    },
                }),
            },
            { sha: version === '1.0.0' ? '1'.repeat(40) : '2'.repeat(40) }
        )

    let archives: Map<string, Buffer>
    let downloads: GithubPluginSource[]
    let downloadSpy: ReturnType<typeof spyOn>

    beforeAll(async () => {
        const owner = await createSignedInUser({
            email: `plugins-owner-${stamp}@example.com`,
            name: 'Plugins Owner',
        })
        ownerId = owner.userId
        ownerToken = owner.token
        const other = await createSignedInUser({
            email: `plugins-other-${stamp}@example.com`,
            name: 'Plugins Other',
        })
        otherId = other.userId
        otherToken = other.token
    })

    beforeEach(async () => {
        await prisma.userPlugin.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })
        archives = new Map([['acme/release', releasePlugin()]])
        downloads = []
        downloadSpy = spyOn(pluginGithub, 'downloadArchive').mockImplementation(
            async (source: GithubPluginSource) => {
                downloads.push(source)
                const archive = archives.get(`${source.owner}/${source.repo}`)
                if (!archive) {
                    const { AppError } = await import('../../src/shared/appError')
                    throw new AppError(
                        'Repository or branch not found. Only public repositories can be installed.',
                        404
                    )
                }
                return archive
            }
        )
    })

    afterEach(() => {
        downloadSpy.mockRestore()
    })

    afterAll(async () => {
        await cleanupTestUser({ id: ownerId })
        await cleanupTestUser({ id: otherId })
    })

    describe('sign-in', () => {
        it('refuses every route without a token', async () => {
            const anon = as(null)
            for (const res of await Promise.all([
                anon.get('/'),
                anon.get('/marketplace'),
                anon.post('/', { source: 'github' }),
                anon.patch('/github', { enabled: false }),
                anon.post('/github/update'),
                anon.delete('/github'),
            ])) {
                expect(res.status).toBe(401)
            }
            expect(downloads).toHaveLength(0)
        })
    })

    describe('marketplace', () => {
        it('lists the built-in plugins with what is installed', async () => {
            await as(ownerToken).post('/', { source: 'playwright' })
            const res = await as(ownerToken).get('/marketplace')
            expect(res.status).toBe(200)
            const [market] = res.body.data.marketplaces
            expect(market.name).toBe('december-official')
            const playwright = market.plugins.find((p: { name: string }) => p.name === 'playwright')
            expect(playwright).toMatchObject({
                installed: true,
                updateAvailable: false,
                mcpServers: ['playwright'],
            })
            expect(market.plugins.find((p: { name: string }) => p.name === 'github').env).toEqual([
                'GITHUB_PERSONAL_ACCESS_TOKEN',
            ])
        })

        it('installs a marketplace entry by name and by name@december-official, like the cli', async () => {
            const byName = await as(ownerToken).post('/', { source: 'github' })
            expect(byName.status).toBe(201)
            expect(byName.body.data.plugin).toMatchObject({
                name: 'github',
                sourceKind: 'marketplace',
                source: 'github@december-official',
                enabled: true,
                mcpServers: [
                    {
                        name: 'github',
                        transport: 'stdio',
                        target: 'npx -y @modelcontextprotocol/server-github',
                    },
                ],
                env: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
                fileCount: 2,
            })
            const full = await as(ownerToken).post('/', { source: 'context7@december-official' })
            expect(full.status).toBe(201)
            expect(downloads).toHaveLength(0)
        })

        it('refuses another marketplace and an unknown entry', async () => {
            const other = await as(ownerToken).post('/', { source: 'tool@someone-else' })
            expect(other.status).toBe(400)
            const unknown = await as(ownerToken).post('/', {
                source: 'nothing-here@december-official',
            })
            expect(unknown.status).toBe(404)
        })
    })

    describe('install from github', () => {
        it('installs owner/repo: skills, mcp servers, files and the commit', async () => {
            const res = await as(ownerToken).post('/', { source: 'acme/release' })
            expect(res.status).toBe(201)
            expect(res.body.data.plugin).toMatchObject({
                name: 'release',
                version: '1.0.0',
                description: 'Ships releases',
                sourceKind: 'github',
                source: 'acme/release',
                commitSha: '1'.repeat(40),
                skills: [{ name: 'ship', description: 'ship it' }],
                fileCount: 4,
                updateAvailable: false,
            })
            expect(
                res.body.data.plugin.mcpServers.map((s: { name: string }) => s.name).sort()
            ).toEqual(['docs', 'notes'])
            // the api never sends the files or the skill text
            expect(JSON.stringify(res.body)).not.toContain('CLAUDE_PLUGIN_ROOT}/bin')

            const row = await prisma.userPlugin.findFirst({
                where: { userId: ownerId, name: 'release' },
            })
            const files = JSON.parse(gunzipSync(Buffer.from(row!.files!)).toString('utf8'))
            expect(files.map((f: { path: string }) => f.path).sort()).toEqual([
                'bin/ship.sh',
                'mcp.json',
                'plugin.json',
                'skills/ship/SKILL.md',
            ])
            expect(files.find((f: { path: string }) => f.path === 'bin/ship.sh').mode).toBe(0o755)
        })

        it('installs a folder of a repository from a github.com tree link', async () => {
            archives.set(
                'acme/mono',
                makeRepoArchive({
                    'README.md': 'mono',
                    'plugins/lint/SKILL.md': '---\nname: lint\ndescription: lints\n---\nlint',
                })
            )
            const res = await as(ownerToken).post('/', {
                source: 'https://github.com/acme/mono/tree/main/plugins/lint',
            })
            expect(res.status).toBe(201)
            expect(res.body.data.plugin).toMatchObject({
                name: 'lint',
                source: 'acme/mono/plugins/lint#main',
                skills: [{ name: 'lint' }],
            })
            expect(downloads[0]).toEqual({
                kind: 'github',
                owner: 'acme',
                repo: 'mono',
                ref: 'main',
                path: 'plugins/lint',
            })
        })

        it('refuses ssrf-shaped sources before any download', async () => {
            for (const source of [
                'https://169.254.169.254/latest/meta-data',
                'http://github.com/acme/release',
                'https://github.com.evil.com/acme/release',
                'https://localhost:8080/acme/release',
                'https://10.0.0.1/acme/release',
                'file:///etc/passwd',
                'git@github.com:acme/release.git',
                'https://gitlab.com/acme/release',
                '../../etc/passwd',
            ]) {
                const res = await as(ownerToken).post('/', { source })
                expect(res.status).toBe(400)
            }
            expect(downloads).toHaveLength(0)
        })

        it('refuses bad bodies', async () => {
            for (const body of [
                {},
                { source: '' },
                { source: 3 },
                { source: 'x'.repeat(301) },
                { source: 'acme/release', extra: 1 },
            ]) {
                const res = await as(ownerToken).post('/', body)
                expect(res.status).toBe(400)
            }
        })

        it('says why a repository cannot be installed', async () => {
            const missing = await as(ownerToken).post('/', { source: 'acme/missing' })
            expect(missing.status).toBe(404)

            archives.set(
                'acme/market',
                makeRepoArchive({ '.claude-plugin/marketplace.json': '{"name":"m","plugins":[]}' })
            )
            const market = await as(ownerToken).post('/', { source: 'acme/market' })
            expect(market.status).toBe(400)
            expect(market.body.message).toContain('marketplace')

            archives.set('acme/empty', makeRepoArchive({ 'index.js': 'module.exports = 1' }))
            expect((await as(ownerToken).post('/', { source: 'acme/empty' })).status).toBe(400)

            archives.set(
                'acme/huge',
                makeRepoArchive(
                    Object.fromEntries(
                        Array.from({ length: 301 }, (_, i) => [`skills/s/f${i}.md`, 'x'])
                    )
                )
            )
            expect((await as(ownerToken).post('/', { source: 'acme/huge' })).status).toBe(413)

            archives.set(
                'acme/badname',
                makeRepoArchive({ 'plugin.json': JSON.stringify({ name: '../evil' }) })
            )
            expect((await as(ownerToken).post('/', { source: 'acme/badname' })).status).toBe(400)
            expect(await prisma.userPlugin.count({ where: { userId: ownerId } })).toBe(0)
        })

        it('refuses a second install of one name', async () => {
            expect((await as(ownerToken).post('/', { source: 'acme/release' })).status).toBe(201)
            const again = await as(ownerToken).post('/', { source: 'acme/release' })
            expect(again.status).toBe(409)
        })

        it('keeps the account at 20 plugins', async () => {
            await prisma.userPlugin.createMany({
                data: Array.from({ length: 20 }, (_, i) => ({
                    userId: ownerId,
                    name: `filler-${i}`,
                    sourceKind: 'github',
                    source: 'acme/filler',
                })),
            })
            const res = await as(ownerToken).post('/', { source: 'acme/release' })
            expect(res.status).toBe(409)
            expect(downloads).toHaveLength(0)
        })
    })

    describe('list, switch, update, uninstall', () => {
        beforeEach(async () => {
            expect((await as(ownerToken).post('/', { source: 'acme/release' })).status).toBe(201)
        })

        it('lists the plugins of the account only', async () => {
            const mine = await as(ownerToken).get('/')
            expect(mine.status).toBe(200)
            expect(mine.body.data.plugins.map((p: { name: string }) => p.name)).toEqual(['release'])
            const theirs = await as(otherToken).get('/')
            expect(theirs.body.data.plugins).toEqual([])
        })

        it('turns a plugin off and on, strictly', async () => {
            const off = await as(ownerToken).patch('/release', { enabled: false })
            expect(off.status).toBe(200)
            expect(off.body.data.plugin.enabled).toBe(false)
            expect((await as(ownerToken).patch('/release', { enabled: 'no' })).status).toBe(400)
            expect(
                (await as(ownerToken).patch('/release', { enabled: true, name: 'x' })).status
            ).toBe(400)
            expect((await as(ownerToken).patch('/release', {})).status).toBe(400)
            expect((await as(ownerToken).patch('/bad..name', { enabled: true })).status).toBe(400)
            expect((await as(ownerToken).patch('/nothing', { enabled: true })).status).toBe(404)
        })

        it('updates from github, and leaves the same commit as it is', async () => {
            const same = await as(ownerToken).post('/release/update')
            expect(same.status).toBe(200)
            expect(same.body.data.changed).toBe(false)

            archives.set('acme/release', releasePlugin('1.1.0'))
            const newer = await as(ownerToken).post('/release/update')
            expect(newer.status).toBe(200)
            expect(newer.body.data).toMatchObject({
                changed: true,
                plugin: { name: 'release', version: '1.1.0', commitSha: '2'.repeat(40) },
            })
        })

        it('updates a marketplace plugin from the catalog', async () => {
            await as(ownerToken).post('/', { source: 'github' })
            await prisma.userPlugin.updateMany({
                where: { userId: ownerId, name: 'github' },
                data: { version: '0.1.0' },
            })
            const listed = await as(ownerToken).get('/')
            expect(
                listed.body.data.plugins.find((p: { name: string }) => p.name === 'github')
                    .updateAvailable
            ).toBe(true)

            const res = await as(ownerToken).post('/github/update')
            expect(res.status).toBe(200)
            expect(res.body.data).toMatchObject({
                changed: true,
                plugin: { version: '1.0.0', updateAvailable: false },
            })
        })

        it('uninstalls a plugin', async () => {
            const res = await as(ownerToken).delete('/release')
            expect(res.status).toBe(200)
            expect(await prisma.userPlugin.count({ where: { userId: ownerId } })).toBe(0)
            expect((await as(ownerToken).delete('/release')).status).toBe(404)
        })

        it("never reads or changes another user's plugin", async () => {
            expect((await as(otherToken).patch('/release', { enabled: false })).status).toBe(404)
            expect((await as(otherToken).post('/release/update')).status).toBe(404)
            expect((await as(otherToken).delete('/release')).status).toBe(404)
            const row = await prisma.userPlugin.findFirst({
                where: { userId: ownerId, name: 'release' },
            })
            expect(row?.enabled).toBe(true)
            // the other user can install a plugin of the same name for themselves
            expect((await as(otherToken).post('/', { source: 'acme/release' })).status).toBe(201)
        })
    })

    describe('prompt box', () => {
        it('lists the plugins and the skills of plugins that are on', async () => {
            await as(ownerToken).post('/', { source: 'acme/release' })
            const promptBox = () =>
                request(app)
                    .get('/api/v1/connections/prompt-box')
                    .set('x-forwarded-for', getRandomIP())
                    .set('Authorization', `Bearer ${ownerToken}`)
            const on = await promptBox()
            expect(on.body.data.plugins).toEqual([{ name: 'release', enabled: true }])
            expect(on.body.data.skills).toEqual([
                { name: 'ship', description: 'ship it', plugin: 'release' },
            ])

            await as(ownerToken).patch('/release', { enabled: false })
            const off = await promptBox()
            expect(off.body.data.plugins).toEqual([{ name: 'release', enabled: false }])
            expect(off.body.data.skills).toEqual([])
        })
    })
})
