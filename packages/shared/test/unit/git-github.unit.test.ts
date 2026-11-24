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
        })
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
})
