import { describe, expect, it } from 'bun:test'

import {
    ARCHIVE_HOST,
    archiveUrl,
    checkPublicHost,
    downloadArchive,
    normalizeRepoPath,
    parseGithubSource,
    readArchive,
} from '../../src/modules/plugin/plugin.github'
import { AppError } from '../../src/shared/appError'
import { makeRepoArchive } from '../support/plugin-archive'

const publicResolver = async () => ['140.82.112.10']

const refused = (fn: () => unknown, status = 400) => {
    try {
        fn()
    } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        expect((error as AppError).statusCode).toBe(status)
        return (error as AppError).message
    }
    throw new Error('expected a refusal')
}

const refusedAsync = async (fn: () => Promise<unknown>, status: number) => {
    try {
        await fn()
    } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        expect((error as AppError).statusCode).toBe(status)
        return (error as AppError).message
    }
    throw new Error('expected a refusal')
}

describe('parseGithubSource', () => {
    it('reads owner/repo, github:owner/repo and a branch after #', () => {
        expect(parseGithubSource('acme/tools')).toEqual({
            kind: 'github',
            owner: 'acme',
            repo: 'tools',
        })
        expect(parseGithubSource('github:acme/tools')).toEqual({
            kind: 'github',
            owner: 'acme',
            repo: 'tools',
        })
        expect(parseGithubSource('acme/tools.git#release/v2')).toEqual({
            kind: 'github',
            owner: 'acme',
            repo: 'tools',
            ref: 'release/v2',
        })
    })

    it('reads github.com links, with .git, a branch and a folder', () => {
        expect(parseGithubSource('https://github.com/acme/tools')).toEqual({
            kind: 'github',
            owner: 'acme',
            repo: 'tools',
        })
        expect(parseGithubSource('https://github.com/acme/tools.git')).toMatchObject({
            repo: 'tools',
        })
        expect(parseGithubSource('github.com/acme/tools')).toMatchObject({ owner: 'acme' })
        expect(
            parseGithubSource('https://github.com/acme/tools/tree/main/plugins/release')
        ).toEqual({
            kind: 'github',
            owner: 'acme',
            repo: 'tools',
            ref: 'main',
            path: 'plugins/release',
        })
        expect(parseGithubSource('https://github.com/acme/tools#v1')).toMatchObject({ ref: 'v1' })
    })

    it('refuses every other host, scheme and internal address (no ssrf)', () => {
        for (const input of [
            'http://github.com/acme/tools',
            'https://github.com.evil.com/acme/tools',
            'https://evil.com/github.com/acme/tools',
            'https://gitlab.com/acme/tools',
            'https://169.254.169.254/latest/meta-data',
            'https://127.0.0.1/acme/tools',
            'https://localhost/acme/tools',
            'https://[::1]/acme/tools',
            'https://github.com:8443/acme/tools',
            'https://user:pass@github.com/acme/tools',
            'https://github.com/acme/tools?x=1',
            'git@github.com:acme/tools.git',
            'ssh://git@github.com/acme/tools',
            'file:///etc/passwd',
            '/etc/passwd',
            './plugins/local',
            '~/plugins',
            'acme',
            'acme/tools/extra',
            '',
            'acme/ tools',
        ]) {
            refused(() => parseGithubSource(input))
        }
    })

    it('refuses unsafe owner, repo, branch and folder parts', () => {
        refused(() => parseGithubSource('-acme/tools'))
        refused(() => parseGithubSource('acme/..'))
        refused(() => parseGithubSource('acme/tools#../../etc'))
        refused(() => parseGithubSource('acme/tools#-x'))
        refused(() => parseGithubSource('https://github.com/acme/tools/tree/main/a$b'))
        // the url drops ".." itself, so a folder never leaves the repository
        expect(parseGithubSource('https://github.com/acme/tools/tree/main/../x')).toMatchObject({
            ref: 'x',
        })
        refused(() => parseGithubSource('https://github.com/acme/tools/blob/main/x'))
        refused(() => parseGithubSource(`acme/${'r'.repeat(301)}`))
    })
})

describe('normalizeRepoPath', () => {
    it('keeps plain parts and refuses ".." and odd characters', () => {
        expect(normalizeRepoPath('plugins//release/')).toBe('plugins/release')
        expect(normalizeRepoPath('')).toBe('')
        expect(normalizeRepoPath('a/../b')).toBeNull()
        expect(normalizeRepoPath('a/$(x)')).toBeNull()
    })
})

describe('archiveUrl', () => {
    it('is always the fixed codeload host, the ref encoded part by part', () => {
        expect(archiveUrl({ kind: 'github', owner: 'acme', repo: 'tools' })).toBe(
            `https://${ARCHIVE_HOST}/acme/tools/tar.gz/HEAD`
        )
        expect(archiveUrl({ kind: 'github', owner: 'acme', repo: 'tools', ref: 'feat/a b' })).toBe(
            `https://${ARCHIVE_HOST}/acme/tools/tar.gz/feat/a%20b`
        )
    })
})

describe('checkPublicHost', () => {
    it('refuses a name that resolves to an internal address, or to nothing', async () => {
        await refusedAsync(() => checkPublicHost(ARCHIVE_HOST, async () => ['10.0.0.5']), 502)
        await refusedAsync(
            () => checkPublicHost(ARCHIVE_HOST, async () => ['140.82.112.10', '169.254.169.254']),
            502
        )
        await refusedAsync(() => checkPublicHost(ARCHIVE_HOST, async () => ['::1']), 502)
        await refusedAsync(() => checkPublicHost(ARCHIVE_HOST, async () => []), 502)
        await refusedAsync(
            () =>
                checkPublicHost(ARCHIVE_HOST, async () => {
                    throw new Error('ENOTFOUND')
                }),
            502
        )
        await checkPublicHost(ARCHIVE_HOST, publicResolver)
    })
})

describe('downloadArchive', () => {
    const source = { kind: 'github' as const, owner: 'acme', repo: 'tools' }

    it('asks the fixed url with no redirects and gives the body', async () => {
        const calls: Array<{ url: string; init: RequestInit }> = []
        const body = await downloadArchive(source, {
            resolve: publicResolver,
            fetchImpl: (async (url: string, init: RequestInit) => {
                calls.push({ url, init })
                return new Response('archive-bytes', { status: 200 })
            }) as unknown as typeof fetch,
        })
        expect(body.toString()).toBe('archive-bytes')
        expect(calls[0]?.url).toBe(`https://${ARCHIVE_HOST}/acme/tools/tar.gz/HEAD`)
        expect(calls[0]?.init.redirect).toBe('manual')
    })

    it('never fetches when the host resolves inside the network', async () => {
        let fetched = false
        await refusedAsync(
            () =>
                downloadArchive(source, {
                    resolve: async () => ['192.168.1.1'],
                    fetchImpl: (async () => {
                        fetched = true
                        return new Response('x')
                    }) as unknown as typeof fetch,
                }),
            502
        )
        expect(fetched).toBe(false)
    })

    it('refuses a redirect, a 404, a server error and a body over the limit', async () => {
        const answer = (response: Response) =>
            ({
                resolve: publicResolver,
                fetchImpl: (async () => response) as unknown as typeof fetch,
            }) as const
        await refusedAsync(
            () =>
                downloadArchive(
                    source,
                    answer(
                        new Response(null, {
                            status: 302,
                            headers: { location: 'http://10.0.0.1/' },
                        })
                    )
                ),
            502
        )
        await refusedAsync(
            () => downloadArchive(source, answer(new Response('no', { status: 404 }))),
            404
        )
        await refusedAsync(
            () => downloadArchive(source, answer(new Response('no', { status: 500 }))),
            502
        )
        await refusedAsync(
            () =>
                downloadArchive(source, {
                    ...answer(new Response('x'.repeat(2000))),
                    maxBytes: 1000,
                }),
            413
        )
        await refusedAsync(
            () =>
                downloadArchive(source, {
                    ...answer(new Response('x', { headers: { 'content-length': '5000' } })),
                    maxBytes: 1000,
                }),
            413
        )
    })

    it('says GitHub took too long when the fetch times out', async () => {
        const message = await refusedAsync(
            () =>
                downloadArchive(source, {
                    resolve: publicResolver,
                    fetchImpl: (async () => {
                        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
                    }) as unknown as typeof fetch,
                }),
            502
        )
        expect(message).toContain('too long')
    })
})

describe('readArchive', () => {
    it('gives the files without the top folder, the mode and the commit sha', () => {
        const archive = makeRepoArchive(
            {
                'plugin.json': '{"name":"x"}',
                'bin/run.sh': { data: 'echo hi', mode: 0o755 },
                [`${'deep/'.repeat(25)}file.txt`]: 'long path',
            },
            { sha: 'b'.repeat(40) }
        )
        const { commitSha, entries } = readArchive(archive)
        expect(commitSha).toBe('b'.repeat(40))
        expect(entries.map((entry) => entry.path)).toEqual([
            'plugin.json',
            'bin/run.sh',
            `${'deep/'.repeat(25)}file.txt`,
        ])
        expect(entries[1]?.mode & 0o111).toBeTruthy()
    })

    it('skips links, folders and paths that leave the folder', () => {
        const archive = makeRepoArchive({
            'link-to-etc': { data: '', type: '2' },
            'hard-link': { data: '', type: '1' },
            '../escape.txt': 'no',
            'ok.txt': 'yes',
        })
        expect(readArchive(archive).entries.map((entry) => entry.path)).toEqual(['ok.txt'])
    })

    it('has no sha without a pax header, and refuses bad or too big archives', () => {
        expect(readArchive(makeRepoArchive({ 'a.txt': 'a' }, { sha: null })).commitSha).toBeNull()
        refused(() => readArchive(Buffer.from('not gzip')), 422)
        refused(
            () =>
                readArchive(makeRepoArchive({ 'a.txt': 'x'.repeat(5000) }), {
                    maxUnzippedBytes: 1000,
                }),
            413
        )
        refused(
            () =>
                readArchive(makeRepoArchive({ 'a.txt': 'a', 'b.txt': 'b', 'c.txt': 'c' }), {
                    maxEntries: 2,
                }),
            413
        )
    })
})
