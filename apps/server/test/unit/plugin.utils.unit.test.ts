import { gunzipSync } from 'node:zlib'

import { BUILT_IN_MARKETPLACE } from '@december/shared'
import { describe, expect, it } from 'bun:test'

import {
    MAX_PLUGIN_FILES,
    catalogPlugin,
    checkPluginLimits,
    encodePluginFiles,
    fallbackPluginName,
    findCatalogEntry,
    isSafePluginName,
    parsePluginFiles,
    parseSkillFile,
    readPluginMcpServers,
    readPluginSkills,
    selectPluginFiles,
    sourceLabel,
    stagePluginFiles,
    toMarketplaceListing,
    toPluginMcpConfig,
    toPublicPlugin,
} from '../../src/modules/plugin/plugin.utils'
import { AppError } from '../../src/shared/appError'

import type { PluginFile } from '../../src/modules/plugin/plugin.types'

const file = (path: string, text: string, mode = 0o644): PluginFile => ({
    path,
    mode,
    data: Buffer.from(text, 'utf8'),
})

const statusOf = (fn: () => unknown) => {
    try {
        fn()
    } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        return (error as AppError).statusCode
    }
    throw new Error('expected a refusal')
}

const skillMd = (name: string, description = `does ${name}`) =>
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\nsteps`

describe('selectPluginFiles', () => {
    const entries = [
        { path: 'README.md', mode: 0o644, data: Buffer.from('r') },
        { path: '.git/config', mode: 0o644, data: Buffer.from('g') },
        { path: 'plugins/a/plugin.json', mode: 0o644, data: Buffer.from('{}') },
        { path: 'plugins/a/.git/HEAD', mode: 0o644, data: Buffer.from('h') },
        { path: 'plugins/ab/x', mode: 0o644, data: Buffer.from('x') },
    ]

    it('takes the whole repository or one folder, without version control data', () => {
        expect(selectPluginFiles(entries, '').map((f) => f.path)).toEqual([
            'README.md',
            'plugins/a/plugin.json',
            'plugins/ab/x',
        ])
        expect(selectPluginFiles(entries, 'plugins/a').map((f) => f.path)).toEqual(['plugin.json'])
    })

    it('refuses a folder that is not there', () => {
        expect(statusOf(() => selectPluginFiles(entries, 'plugins/zzz'))).toBe(404)
    })
})

describe('checkPluginLimits', () => {
    it('refuses too many files, one big file and a big plugin', () => {
        const many = Array.from({ length: MAX_PLUGIN_FILES + 1 }, (_, i) => file(`f${i}`, 'x'))
        expect(statusOf(() => checkPluginLimits(many))).toBe(413)
        expect(statusOf(() => checkPluginLimits([file('big', 'x'.repeat(1024 * 1024 + 1))]))).toBe(
            413
        )
        const four = Array.from({ length: 4 }, (_, i) => file(`p${i}`, 'x'.repeat(900 * 1024)))
        expect(statusOf(() => checkPluginLimits(four))).toBe(413)
        checkPluginLimits([file('ok', 'x')])
    })
})

describe('stagePluginFiles (the cli staging)', () => {
    it('keeps a folder with a plugin.json (also .claude-plugin/plugin.json) as it is', () => {
        const files = [file('.claude-plugin/plugin.json', '{"name":"cc"}'), file('a.txt', 'a')]
        const staged = stagePluginFiles({ files, fallbackName: 'x', label: 'o/r' })
        expect(staged.files).toBe(files)
        expect(staged.manifest.name).toBe('cc')
    })

    it('refuses a marketplace', () => {
        expect(
            statusOf(() =>
                stagePluginFiles({
                    files: [file('.claude-plugin/marketplace.json', '{}')],
                    fallbackName: 'x',
                    label: 'o/r',
                })
            )
        ).toBe(400)
    })

    it('makes a plugin.json for a skills/ folder', () => {
        const staged = stagePluginFiles({
            files: [file('skills/a/SKILL.md', skillMd('a'))],
            fallbackName: 'owner-repo',
            label: 'owner/repo',
        })
        expect(staged.manifest).toEqual({
            name: 'owner-repo',
            description: 'Skills from owner/repo',
            version: '1.0.0',
        })
        expect(staged.files.map((f) => f.path)).toEqual(['skills/a/SKILL.md', 'plugin.json'])
    })

    it('moves skill folders at the root into skills/ and drops the rest', () => {
        const staged = stagePluginFiles({
            files: [
                file('lint/SKILL.md', skillMd('lint')),
                file('lint/run.sh', 'echo', 0o755),
                file('docs/readme.md', 'no skill here'),
                file('README.md', 'root'),
            ],
            fallbackName: 'pack',
            label: 'o/r',
        })
        expect(staged.files.map((f) => f.path)).toEqual([
            'skills/lint/SKILL.md',
            'skills/lint/run.sh',
            'plugin.json',
        ])
    })

    it('makes one skill at the root into skills/<name>', () => {
        const staged = stagePluginFiles({
            files: [file('SKILL.md', skillMd('one')), file('ref.md', 'r')],
            fallbackName: 'one',
            label: 'o/r',
        })
        expect(staged.files.map((f) => f.path)).toEqual([
            'skills/one/SKILL.md',
            'skills/one/ref.md',
            'plugin.json',
        ])
    })

    it('refuses a source with no plugin.json and no skills', () => {
        expect(
            statusOf(() =>
                stagePluginFiles({
                    files: [file('index.js', 'x')],
                    fallbackName: 'x',
                    label: 'o/r',
                })
            )
        ).toBe(400)
    })
})

describe('parseSkillFile and readPluginSkills', () => {
    it('reads the front matter and the text after it', () => {
        expect(parseSkillFile(skillMd('lint', '"Checks code"'))).toEqual({
            name: 'lint',
            description: 'Checks code',
            body: '# lint\nsteps',
        })
        expect(parseSkillFile('no front matter')).toEqual({ body: 'no front matter' })
    })

    it('uses the folder name when the front matter name cannot be used, and keeps the folder', () => {
        const skills = readPluginSkills([
            file('skills/b/SKILL.md', skillMd('has spaces')),
            file('skills/a/skill.md', skillMd('alpha')),
            file('skills/c/notes.md', 'not a skill'),
            file('skills/d/SKILL.md', skillMd('alpha')),
        ])
        expect(skills.map((s) => [s.name, s.dir])).toEqual([
            ['alpha', 'a'],
            ['b', 'b'],
        ])
    })

    it('cuts a long body and refuses too many skills', () => {
        const [skill] = readPluginSkills([
            file('skills/a/SKILL.md', `---\nname: a\n---\n${'x'.repeat(70_000)}`),
        ])
        expect(skill?.body.length).toBe(64 * 1024)
        const many = Array.from({ length: 101 }, (_, i) =>
            file(`skills/s${i}/SKILL.md`, skillMd(`s${i}`))
        )
        expect(statusOf(() => readPluginSkills(many))).toBe(413)
    })
})

describe('toPluginMcpConfig and readPluginMcpServers', () => {
    it('reads command and url servers like the cli (sse is the default)', () => {
        expect(
            toPluginMcpConfig({
                command: 'npx',
                args: ['-y', 'x', 3],
                env: { TOKEN: '${T}', 'bad name': 'x' },
            })
        ).toEqual({
            command: 'npx',
            args: ['-y', 'x'],
            env: { TOKEN: '${T}' },
        })
        expect(
            toPluginMcpConfig({
                url: 'https://mcp.example.com',
                type: 'http',
                headers: { 'X-Key': 'v' },
            })
        ).toEqual({
            url: 'https://mcp.example.com',
            transport: 'http',
            headers: { 'X-Key': 'v' },
        })
        expect(toPluginMcpConfig({ sse: 'https://x.example.com/sse' })).toMatchObject({
            transport: 'sse',
        })
        expect(toPluginMcpConfig({ command: 'x'.repeat(501) })).toBeNull()
        expect(toPluginMcpConfig('nope')).toBeNull()
        expect(toPluginMcpConfig({})).toBeNull()
    })

    it('reads mcp.json with or without mcpServers, and skips bad names', () => {
        expect(
            Object.keys(
                readPluginMcpServers([
                    file(
                        'mcp.json',
                        JSON.stringify({
                            mcpServers: { ok: { command: 'a' }, 'bad name': { command: 'b' } },
                        })
                    ),
                ])
            )
        ).toEqual(['ok'])
        expect(
            Object.keys(
                readPluginMcpServers([
                    file('.mcp.json', JSON.stringify({ x: { url: 'https://a.b' } })),
                ])
            )
        ).toEqual(['x'])
        expect(readPluginMcpServers([file('mcp.json', 'not json')])).toEqual({})
        const many = Object.fromEntries(
            Array.from({ length: 21 }, (_, i) => [`s${i}`, { command: 'a' }])
        )
        expect(statusOf(() => readPluginMcpServers([file('mcp.json', JSON.stringify(many))]))).toBe(
            413
        )
    })
})

describe('parsePluginFiles', () => {
    it('reads the manifest, the skills and the mcp servers', () => {
        const plugin = parsePluginFiles({
            files: [
                file(
                    'plugin.json',
                    JSON.stringify({
                        name: 'release',
                        version: '2.0.0',
                        description: 'Ships',
                        author: { name: 'Acme' },
                    })
                ),
                file('skills/ship/SKILL.md', skillMd('ship')),
                file(
                    'mcp.json',
                    JSON.stringify({
                        mcpServers: { docs: { url: 'https://docs.example.com/mcp' } },
                    })
                ),
            ],
            fallbackName: 'acme-release',
            label: 'acme/release',
        })
        expect(plugin).toMatchObject({
            name: 'release',
            version: '2.0.0',
            description: 'Ships',
            author: 'Acme',
            skills: [{ name: 'ship', dir: 'ship' }],
        })
        expect(Object.keys(plugin.mcpServers)).toEqual(['docs'])
    })

    it('refuses a plugin name the cli cannot use', () => {
        expect(
            statusOf(() =>
                parsePluginFiles({
                    files: [file('plugin.json', JSON.stringify({ name: '../../etc' }))],
                    fallbackName: 'x',
                    label: 'o/r',
                })
            )
        ).toBe(400)
        expect(isSafePluginName('a..b')).toBe(false)
        expect(isSafePluginName('ok-name_1.2')).toBe(true)
    })
})

describe('names, encoding and the catalog', () => {
    it('names a source without a manifest owner-repo or by its folder', () => {
        expect(fallbackPluginName({ owner: 'acme', repo: 'tools.git' })).toBe('acme-tools')
        expect(fallbackPluginName({ owner: 'acme', repo: 'tools', path: 'skills/lint' })).toBe(
            'lint'
        )
    })

    it('encodes the files as gzip json and keeps only the run bit', () => {
        const blob = encodePluginFiles([file('a.sh', 'echo', 0o775), file('b.md', 'b', 0o600)])
        const decoded = JSON.parse(gunzipSync(blob).toString('utf8'))
        expect(decoded).toEqual([
            { path: 'a.sh', mode: 0o755, data: Buffer.from('echo').toString('base64') },
            { path: 'b.md', mode: 0o644, data: Buffer.from('b').toString('base64') },
        ])
    })

    it('finds a built-in entry by name or name@december-official only', () => {
        expect(findCatalogEntry('GitHub')?.name).toBe('github')
        expect(findCatalogEntry('github@december-official')?.name).toBe('github')
        expect(findCatalogEntry('github@other')).toBeNull()
        expect(findCatalogEntry('acme/tools')).toBeNull()
    })

    it('installs a catalog entry like the cli: plugin.json and mcp.json', () => {
        const entry = BUILT_IN_MARKETPLACE.plugins[0]!
        const plugin = catalogPlugin(entry)
        expect(plugin.files.map((f) => f.path)).toEqual(['plugin.json', 'mcp.json'])
        expect(Object.keys(plugin.mcpServers)).toEqual(Object.keys(entry.mcpServers))
    })

    const record = {
        name: 'github',
        description: 'd',
        version: '0.9.0',
        author: null,
        sourceKind: 'marketplace',
        source: 'december-official',
        ref: null,
        path: null,
        commitSha: null,
        enabled: true,
        skills: [{ name: 'a', description: 'b', body: 'secret body', dir: 'a' }],
        mcpServers: {
            github: { command: 'npx', args: ['-y', 'x'] },
            web: { url: 'https://w.example.com', transport: 'http' },
        },
        fileCount: 2,
        sizeBytes: 10,
        createdAt: new Date(0),
        updatedAt: new Date(0),
    }

    it('returns no skill text or files, and marks an update from the catalog', () => {
        const pub = toPublicPlugin(record)
        expect(pub.skills).toEqual([{ name: 'a', description: 'b' }])
        expect(JSON.stringify(pub)).not.toContain('secret body')
        expect(pub.mcpServers).toEqual([
            { name: 'github', transport: 'stdio', target: 'npx -y x' },
            { name: 'web', transport: 'http', target: 'https://w.example.com' },
        ])
        expect(pub.updateAvailable).toBe(true)
        expect(pub.env).toEqual(['GITHUB_PERSONAL_ACCESS_TOKEN'])
        expect(pub.source).toBe('github@december-official')
    })

    it('labels a github source with folder and branch', () => {
        expect(
            sourceLabel({
                ...record,
                sourceKind: 'github',
                source: 'acme/tools',
                path: 'p',
                ref: 'v1',
            })
        ).toBe('acme/tools/p#v1')
    })

    it('lists the catalog with what is installed', () => {
        const listing = toMarketplaceListing([record])
        const github = listing.marketplaces[0]?.plugins.find((p) => p.name === 'github')
        expect(github).toMatchObject({ installed: true, updateAvailable: true })
        expect(
            listing.marketplaces[0]?.plugins.find((p) => p.name === 'playwright')?.installed
        ).toBe(false)
    })
})
