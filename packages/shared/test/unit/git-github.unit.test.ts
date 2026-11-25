import { afterEach, describe, expect, it } from 'bun:test'

import { detectGitProvider, getGitProvider } from '../../src/git'

type Call = { url: string; init?: RequestInit }

const realFetch = globalThis.fetch

const stubFetch = (responder: (call: Call) => Response) => {
    const calls: Call[] = []
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
        const call = { url: String(input), init }
        calls.push(call)
        return responder(call)
    }) as typeof fetch
    return calls
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const github = getGitProvider('GITHUB')

describe('git provider: github', () => {
    afterEach(() => {
        globalThis.fetch = realFetch
    })

    it('detects github urls', () => {
        expect(detectGitProvider('https://github.com/acme/app')).toBe('GITHUB')
        expect(detectGitProvider('https://example.com/acme/app')).toBeNull()
    })

    it('parses owner and name from a repo url', () => {
        expect(github.parseRepoUrl('https://github.com/acme/app.git')).toEqual({
            owner: 'acme',
            name: 'app',
            path: 'acme/app',
        })
        expect(github.parseRepoUrl('https://gitlab.com/acme/app')).toBeNull()
        expect(github.parseRepoUrl('git@github.com:acme/app.git')?.path).toBe('acme/app')
        expect(github.parseRepoUrl('ssh://git@github.com/acme/app')?.path).toBe('acme/app')
        expect(github.parseRepoUrl('https://evil.example/github.com/acme/app')).toBeNull()
    })

    it('builds the x-access-token clone url', () => {
        expect(github.getCloneUrl({ token: 'tok', repoPath: 'acme/app' })).toBe(
            'https://x-access-token:tok@github.com/acme/app.git'
        )
    })

    it('lists repos with the user token and maps them', async () => {
        const calls = stubFetch(() =>
            json([
                {
                    id: 7,
                    name: 'app',
                    full_name: 'acme/app',
                    private: true,
                    default_branch: 'main',
                    updated_at: '2026-11-01T00:00:00Z',
                    html_url: 'https://github.com/acme/app',
                    clone_url: 'https://github.com/acme/app.git',
                    language: 'TypeScript',
                    description: null,
                    owner: { login: 'acme', avatar_url: 'https://avatars/acme' },
                },
            ])
        )

        const repos = await github.listRepos({ token: 'tok', page: 1, limit: 30 })

        expect(calls[0].url).toBe(
            'https://api.github.com/user/repos?sort=updated&per_page=30&page=1'
        )
        expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
        expect(repos).toEqual([
            {
                id: 7,
                name: 'app',
                fullName: 'acme/app',
                private: true,
                defaultBranch: 'main',
                updatedAt: '2026-11-01T00:00:00Z',
                htmlUrl: 'https://github.com/acme/app',
                cloneUrl: 'https://github.com/acme/app.git',
                language: 'TypeScript',
                description: null,
                owner: { login: 'acme', avatarUrl: 'https://avatars/acme' },
                provider: 'GITHUB',
            },
        ])
    })

    it('reads all pages when no page is asked for, and filters by search', async () => {
        const page = (n: number, count: number) =>
            Array.from({ length: count }, (_, i) => ({
                id: n * 1000 + i,
                name: i === 0 ? `match-${n}` : `other-${n}-${i}`,
                full_name: `acme/${i === 0 ? `match-${n}` : `other-${n}-${i}`}`,
                owner: { login: 'acme' },
            }))
        const calls = stubFetch((call) =>
            json(call.url.endsWith('&page=1') ? page(1, 100) : page(2, 3))
        )

        const repos = await github.listRepos({ token: 'tok', search: 'MATCH' })

        expect(calls.length).toBe(2)
        expect(repos.map((r) => r.name)).toEqual(['match-1', 'match-2'])
    })

    it('throws with the status when the repo list fails', async () => {
        stubFetch(() => new Response('bad credentials', { status: 401 }))
        await expect(github.listRepos({ token: 'tok' })).rejects.toMatchObject({
            status: 401,
        })
    })

    it('opens a pull request', async () => {
        const calls = stubFetch(() =>
            json(
                {
                    number: 12,
                    html_url: 'https://github.com/acme/app/pull/12',
                    title: 'feat: x',
                    state: 'open',
                    head: { sha: 'abc' },
                    additions: 3,
                    deletions: 1,
                    changed_files: 2,
                    created_at: 'c',
                    updated_at: 'u',
                },
                201
            )
        )

        const pr = await github.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 'feat: x',
            head: 'december/s1',
            base: 'main',
            body: 'body',
        })

        expect(calls[0].url).toBe('https://api.github.com/repos/acme/app/pulls')
        expect(JSON.parse(String(calls[0].init?.body))).toEqual({
            title: 'feat: x',
            head: 'december/s1',
            base: 'main',
            body: 'body',
        })
        expect(pr).toEqual({
            number: 12,
            url: 'https://github.com/acme/app/pull/12',
            title: 'feat: x',
            state: 'open',
            status: 'open',
            headSha: 'abc',
            additions: 3,
            deletions: 1,
            changedFiles: 2,
            createdAt: 'c',
            updatedAt: 'u',
            mergedAt: null,
            closedAt: null,
        })
    })

    it('opens a draft pull request when draft is set', async () => {
        const calls = stubFetch(() =>
            json({ number: 13, html_url: 'u', title: 'feat: x', state: 'open', draft: true }, 201)
        )

        const pr = await github.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 'feat: x',
            head: 'december/s1',
            base: 'main',
            body: 'body',
            draft: true,
        })

        expect(JSON.parse(String(calls[0].init?.body))).toEqual({
            title: 'feat: x',
            head: 'december/s1',
            base: 'main',
            body: 'body',
            draft: true,
        })
        expect(pr?.status).toBe('draft')
    })

    it('opens a ready pull request when the repository refuses drafts', async () => {
        // github answers 422 for a draft in a repository whose plan has no drafts
        const calls = stubFetch((call) => {
            if (call.init?.method !== 'POST') return json([])
            return JSON.parse(String(call.init.body)).draft
                ? json({ message: 'Draft pull requests are not supported' }, 422)
                : json({ number: 14, html_url: 'u', title: 't', state: 'open' }, 201)
        })

        const pr = await github.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 't',
            head: 'december/s1',
            base: 'main',
            body: '',
            draft: true,
        })

        const posts = calls.filter((call) => call.init?.method === 'POST')
        expect(posts).toHaveLength(2)
        expect(JSON.parse(String(posts[1].init?.body))).toEqual({
            title: 't',
            head: 'december/s1',
            base: 'main',
            body: '',
        })
        expect(pr?.number).toBe(14)
        expect(pr?.status).toBe('open')
    })

    it('returns the existing pull request when one is already open (422)', async () => {
        const calls = stubFetch((call) =>
            call.init?.method === 'POST'
                ? json({ message: 'exists' }, 422)
                : json([
                      { number: 5, html_url: 'https://github.com/acme/app/pull/5', state: 'open' },
                  ])
        )

        const pr = await github.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 't',
            head: 'december/s1',
            base: 'main',
            body: '',
        })

        expect(calls[1].url).toBe(
            'https://api.github.com/repos/acme/app/pulls?head=acme:december/s1&state=all'
        )
        expect(pr?.number).toBe(5)
    })

    it('saves merged and draft pull requests with their own status', async () => {
        const open = async (pr: object) => {
            stubFetch(() => json({ number: 1, state: 'closed', ...pr }, 201))
            return github.createPullRequest({
                token: 'tok',
                repoPath: 'acme/app',
                title: 't',
                head: 'h',
                base: 'main',
                body: '',
            })
        }
        expect((await open({ merged_at: 'x' }))?.status).toBe('merged')
        expect((await open({ state: 'open', draft: true }))?.status).toBe('draft')
        expect((await open({}))?.status).toBe('closed')
    })

    it('returns null when the pull request cannot be opened', async () => {
        stubFetch(() => new Response('nope', { status: 403 }))
        const pr = await github.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 't',
            head: 'h',
            base: 'main',
            body: '',
        })
        expect(pr).toBeNull()
    })

    it('maps check runs to a ci status', async () => {
        const status = async (runs: unknown[]) => {
            stubFetch(() => json({ check_runs: runs }))
            return github.getCiStatus({ token: 'tok', repoPath: 'acme/app', sha: 'abc' })
        }

        expect(await status([{ conclusion: 'failure' }])).toBe('failed')
        expect(await status([{ status: 'queued' }])).toBe('pending')
        expect(await status([{ conclusion: 'success' }])).toBe('passing')
        expect(await status([])).toBe('passing')
    })

    it('lists a folder at the default branch', async () => {
        const calls = stubFetch(() =>
            json([
                { name: 'deploy', path: '.december/skills/deploy', type: 'dir', size: 0 },
                { name: 'notes.md', path: '.december/skills/notes.md', type: 'file', size: 12 },
                { name: 'link', path: '.december/skills/link', type: 'symlink', size: 4 },
                { name: 'vendor', path: '.december/skills/vendor', type: 'submodule', size: 0 },
            ])
        )

        const entries = await github.listDir({
            token: 'tok',
            repoPath: 'acme/app',
            path: '.december/skills',
        })

        // no ref: the host answers for the default branch
        expect(calls[0].url).toBe('https://api.github.com/repos/acme/app/contents/.december/skills')
        expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
        expect(entries).toEqual([
            { name: 'deploy', path: '.december/skills/deploy', type: 'dir' },
            { name: 'notes.md', path: '.december/skills/notes.md', type: 'file' },
        ])
    })

    it('lists the root folder and encodes each part of a path', async () => {
        const calls = stubFetch(() => json([]))

        await github.listDir({ token: 'tok', repoPath: 'acme/app', path: '' })
        await github.listDir({ token: 'tok', repoPath: 'acme/app', path: 'my skills/a#b' })

        expect(calls[0].url).toBe('https://api.github.com/repos/acme/app/contents/')
        expect(calls[1].url).toBe(
            'https://api.github.com/repos/acme/app/contents/my%20skills/a%23b'
        )
    })

    it('throws with the status when a folder cannot be listed', async () => {
        stubFetch(() => json({ message: 'Not Found' }, 404))
        await expect(
            github.listDir({ token: 'tok', repoPath: 'acme/secret', path: '' })
        ).rejects.toMatchObject({ name: 'GitProviderError', status: 404 })
    })

    it('reads a text file', async () => {
        const text = '---\nname: deploy\n---\nship it \u2713\n'
        const calls = stubFetch(() =>
            json({
                type: 'file',
                size: Buffer.byteLength(text),
                encoding: 'base64',
                // github breaks the base64 text into lines
                content: Buffer.from(text)
                    .toString('base64')
                    .replace(/(.{20})/g, '$1\n'),
            })
        )

        const file = await github.readTextFile({
            token: 'tok',
            repoPath: 'acme/app',
            path: '.december/skills/deploy/SKILL.md',
            maxBytes: 64 * 1024,
        })

        expect(calls[0].url).toBe(
            'https://api.github.com/repos/acme/app/contents/.december/skills/deploy/SKILL.md'
        )
        expect(file).toEqual({ size: 33, content: text })
    })

    it('does not return a file that is over the size cap', async () => {
        stubFetch(() =>
            json({ type: 'file', size: 70_000, encoding: 'base64', content: 'aGVsbG8=' })
        )
        const file = await github.readTextFile({
            token: 'tok',
            repoPath: 'acme/app',
            path: 'big.md',
            maxBytes: 64 * 1024,
        })
        expect(file).toEqual({ size: 70_000, content: null })
    })

    it('checks the real size of a file, not only the size the host reports', async () => {
        stubFetch(() =>
            json({
                type: 'file',
                size: 5,
                encoding: 'base64',
                content: Buffer.from('x'.repeat(200)).toString('base64'),
            })
        )
        const file = await github.readTextFile({
            token: 'tok',
            repoPath: 'acme/app',
            path: 'big.md',
            maxBytes: 100,
        })
        expect(file).toEqual({ size: 200, content: null })
    })

    it('throws with the status when a file cannot be read', async () => {
        stubFetch(() => json({ message: 'Not Found' }, 404))
        await expect(
            github.readTextFile({ token: 'tok', repoPath: 'acme/app', path: 'x.md', maxBytes: 10 })
        ).rejects.toMatchObject({ name: 'GitProviderError', status: 404 })

        // a folder is not a file
        stubFetch(() => json([{ name: 'a', path: 'x/a', type: 'file' }]))
        await expect(
            github.readTextFile({ token: 'tok', repoPath: 'acme/app', path: 'x', maxBytes: 10 })
        ).rejects.toMatchObject({ name: 'GitProviderError', status: 404 })
    })
})
