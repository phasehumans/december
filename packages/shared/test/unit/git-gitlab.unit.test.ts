import { afterEach, describe, expect, it } from 'bun:test'

import { detectGitProvider, getGitProvider, gitlabOAuth } from '../../src/git'

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

const bodyOf = (call: Call) => JSON.parse(String(call.init?.body))

const gitlab = getGitProvider('GITLAB')

const project = {
    id: 42,
    path: 'app',
    path_with_namespace: 'acme/tools/app',
    visibility: 'private',
    default_branch: 'develop',
    last_activity_at: '2026-11-01T00:00:00Z',
    web_url: 'https://gitlab.com/acme/tools/app',
    http_url_to_repo: 'https://gitlab.com/acme/tools/app.git',
    description: 'tools',
    namespace: { full_path: 'acme/tools', avatar_url: 'https://gitlab/acme.png' },
}

describe('git provider: gitlab', () => {
    afterEach(() => {
        globalThis.fetch = realFetch
    })

    it('detects gitlab.com urls, including subgroups', () => {
        expect(detectGitProvider('https://gitlab.com/acme/tools/app.git')).toBe('GITLAB')
        expect(gitlab.parseRepoUrl('https://gitlab.com/acme/tools/app')).toEqual({
            owner: 'acme/tools',
            name: 'app',
            path: 'acme/tools/app',
        })
        expect(gitlab.parseRepoUrl('https://github.com/acme/app')).toBeNull()
        expect(gitlab.parseRepoUrl('https://gitlab.com/acme')).toBeNull()
        expect(gitlab.parseRepoUrl('git@gitlab.com:acme/tools/app.git')?.path).toBe(
            'acme/tools/app'
        )
    })

    it('builds the oauth2 clone url', () => {
        expect(gitlab.getCloneUrl({ token: 'tok', repoPath: 'acme/tools/app' })).toBe(
            'https://oauth2:tok@gitlab.com/acme/tools/app.git'
        )
    })

    it('lists member projects and maps them like github repos', async () => {
        const calls = stubFetch(() => json([project]))

        const repos = await gitlab.listRepos({ token: 'tok', page: 2, limit: 20, search: 'app' })

        const url = new URL(calls[0].url)
        expect(url.origin + url.pathname).toBe('https://gitlab.com/api/v4/projects')
        expect(Object.fromEntries(url.searchParams)).toEqual({
            membership: 'true',
            min_access_level: '30',
            order_by: 'last_activity_at',
            sort: 'desc',
            per_page: '20',
            page: '2',
            search: 'app',
            search_namespaces: 'true',
        })
        expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
        expect(repos).toEqual([
            {
                id: 42,
                name: 'app',
                fullName: 'acme/tools/app',
                private: true,
                defaultBranch: 'develop',
                updatedAt: '2026-11-01T00:00:00Z',
                htmlUrl: 'https://gitlab.com/acme/tools/app',
                cloneUrl: 'https://gitlab.com/acme/tools/app.git',
                language: null,
                description: 'tools',
                owner: { login: 'acme/tools', avatarUrl: 'https://gitlab/acme.png' },
                provider: 'GITLAB',
            },
        ])
    })

    it('reads all pages when no page is asked for', async () => {
        const calls = stubFetch((call) => {
            const page = new URL(call.url).searchParams.get('page')
            return json(
                page === '1'
                    ? Array.from({ length: 100 }, (_, i) => ({ ...project, id: i }))
                    : [{ ...project, id: 500 }]
            )
        })

        const repos = await gitlab.listRepos({ token: 'tok' })

        expect(calls.length).toBe(2)
        expect(repos.length).toBe(101)
    })

    it('throws with the status when the project list fails', async () => {
        stubFetch(() => new Response('401 Unauthorized', { status: 401 }))
        await expect(gitlab.listRepos({ token: 'tok' })).rejects.toMatchObject({ status: 401 })
    })

    it('opens a merge request', async () => {
        const calls = stubFetch(() =>
            json(
                {
                    iid: 9,
                    web_url: 'https://gitlab.com/acme/tools/app/-/merge_requests/9',
                    title: 'feat: x',
                    state: 'opened',
                    draft: false,
                    sha: 'abc',
                    changes_count: '4',
                    created_at: 'c',
                    updated_at: 'u',
                },
                201
            )
        )

        const mr = await gitlab.createPullRequest({
            token: 'tok',
            repoPath: 'acme/tools/app',
            title: 'feat: x',
            head: 'december/s1',
            base: 'main',
            body: 'body',
        })

        expect(calls[0].url).toBe(
            'https://gitlab.com/api/v4/projects/acme%2Ftools%2Fapp/merge_requests'
        )
        expect(calls[0].init?.method).toBe('POST')
        expect(bodyOf(calls[0])).toEqual({
            source_branch: 'december/s1',
            target_branch: 'main',
            title: 'feat: x',
            description: 'body',
        })
        expect(mr).toEqual({
            number: 9,
            url: 'https://gitlab.com/acme/tools/app/-/merge_requests/9',
            title: 'feat: x',
            state: 'open',
            status: 'open',
            headSha: 'abc',
            additions: 0,
            deletions: 0,
            changedFiles: 4,
            createdAt: 'c',
            updatedAt: 'u',
            mergedAt: null,
            closedAt: null,
        })
    })

    it('opens a draft merge request with the "Draft:" title when draft is set', async () => {
        const calls = stubFetch(() =>
            json(
                { iid: 10, web_url: 'u', title: 'Draft: feat: x', state: 'opened', draft: true },
                201
            )
        )

        const mr = await gitlab.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 'feat: x',
            head: 'december/s1',
            base: 'main',
            body: 'body',
            draft: true,
        })

        expect(bodyOf(calls[0])).toEqual({
            source_branch: 'december/s1',
            target_branch: 'main',
            title: 'Draft: feat: x',
            description: 'body',
        })
        expect(mr?.status).toBe('draft')
    })

    it('does not add "Draft:" two times', async () => {
        const calls = stubFetch(() => json({ iid: 11, state: 'opened', draft: true }, 201))

        await gitlab.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 'Draft: feat: x',
            head: 'h',
            base: 'main',
            body: '',
            draft: true,
        })

        expect(bodyOf(calls[0]).title).toBe('Draft: feat: x')
    })

    it('returns the existing merge request for the branch (409)', async () => {
        const calls = stubFetch((call) =>
            call.init?.method === 'POST'
                ? json({ message: ['Another open merge request already exists'] }, 409)
                : json([{ iid: 3, state: 'merged', web_url: 'u', title: 't' }])
        )

        const mr = await gitlab.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 't',
            head: 'december/s1',
            base: 'main',
            body: '',
        })

        expect(calls[1].url).toBe(
            'https://gitlab.com/api/v4/projects/acme%2Fapp/merge_requests?source_branch=december%2Fs1'
        )
        expect(mr?.number).toBe(3)
        expect(mr?.status).toBe('merged')
    })

    it('maps draft and closed merge requests', async () => {
        const open = async (mr: object) => {
            stubFetch(() => json({ iid: 1, ...mr }, 201))
            return gitlab.createPullRequest({
                token: 'tok',
                repoPath: 'acme/app',
                title: 't',
                head: 'h',
                base: 'main',
                body: '',
            })
        }
        expect((await open({ state: 'opened', draft: true }))?.status).toBe('draft')
        expect((await open({ state: 'closed' }))?.status).toBe('closed')
        expect((await open({ state: 'locked' }))?.status).toBe('closed')
    })

    it('returns null when gitlab refuses the merge request', async () => {
        stubFetch(() => new Response('forbidden', { status: 403 }))
        const mr = await gitlab.createPullRequest({
            token: 'tok',
            repoPath: 'acme/app',
            title: 't',
            head: 'h',
            base: 'main',
            body: '',
        })
        expect(mr).toBeNull()
    })

    it('maps the latest pipeline for the commit to a ci status', async () => {
        const status = async (pipelines: unknown[]) => {
            const calls = stubFetch(() => json(pipelines))
            const result = await gitlab.getCiStatus({
                token: 'tok',
                repoPath: 'acme/app',
                sha: 'abc',
            })
            expect(calls[0].url).toBe(
                'https://gitlab.com/api/v4/projects/acme%2Fapp/pipelines?sha=abc&per_page=1'
            )
            return result
        }

        expect(await status([{ status: 'failed' }])).toBe('failed')
        expect(await status([{ status: 'canceled' }])).toBe('failed')
        expect(await status([{ status: 'running' }])).toBe('pending')
        expect(await status([{ status: 'success' }])).toBe('passing')
        expect(await status([])).toBe('passing')
    })

    it('comments on an issue', async () => {
        const calls = stubFetch(() => json({ id: 1 }, 201))
        await gitlab.comment({ token: 'tok', repoPath: 'acme/app', issueNumber: 5, body: 'hi' })
        expect(calls[0].url).toBe('https://gitlab.com/api/v4/projects/acme%2Fapp/issues/5/notes')
        expect(bodyOf(calls[0])).toEqual({ body: 'hi' })
    })

    it('refreshes a token', async () => {
        const before = Date.now()
        const calls = stubFetch(() =>
            json({ access_token: 'new', refresh_token: 'new-r', expires_in: 7200 })
        )

        const tokens = await gitlab.refreshToken({
            refreshToken: 'old-r',
            clientId: 'id',
            clientSecret: 'secret',
            redirectUri: 'https://api/cb',
        })

        expect(calls[0].url).toBe('https://gitlab.com/oauth/token')
        expect(bodyOf(calls[0])).toEqual({
            client_id: 'id',
            client_secret: 'secret',
            refresh_token: 'old-r',
            grant_type: 'refresh_token',
            redirect_uri: 'https://api/cb',
        })
        expect(tokens.accessToken).toBe('new')
        expect(tokens.refreshToken).toBe('new-r')
        expect(tokens.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 7200 * 1000)
    })

    it('throws when the refresh is refused', async () => {
        stubFetch(() => json({ error: 'invalid_grant' }, 400))
        await expect(
            gitlab.refreshToken({
                refreshToken: 'r',
                clientId: 'id',
                clientSecret: 's',
                redirectUri: 'cb',
            })
        ).rejects.toMatchObject({ status: 400 })
    })

    it('lists a folder at the default branch', async () => {
        const calls = stubFetch(() =>
            json([
                { name: 'deploy', path: '.december/skills/deploy', type: 'tree' },
                { name: 'notes.md', path: '.december/skills/notes.md', type: 'blob' },
                { name: 'vendor', path: '.december/skills/vendor', type: 'commit' },
            ])
        )

        const entries = await gitlab.listDir({
            token: 'tok',
            repoPath: 'acme/tools/app',
            path: '.december/skills',
        })

        const url = new URL(calls[0].url)
        expect(url.origin + url.pathname).toBe(
            'https://gitlab.com/api/v4/projects/acme%2Ftools%2Fapp/repository/tree'
        )
        // no ref: the host answers for the default branch
        expect(Object.fromEntries(url.searchParams)).toEqual({
            path: '.december/skills',
            per_page: '100',
            page: '1',
        })
        expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
        expect(entries).toEqual([
            { name: 'deploy', path: '.december/skills/deploy', type: 'dir' },
            { name: 'notes.md', path: '.december/skills/notes.md', type: 'file' },
        ])
    })

    it('reads the next page of a large folder, and sends no path for the root', async () => {
        const calls = stubFetch((call) => {
            const page = new URL(call.url).searchParams.get('page')
            return json(
                page === '1'
                    ? Array.from({ length: 100 }, (_, i) => ({
                          name: `f${i}`,
                          path: `f${i}`,
                          type: 'blob',
                      }))
                    : [{ name: 'AGENTS.md', path: 'AGENTS.md', type: 'blob' }]
            )
        })

        const entries = await gitlab.listDir({ token: 'tok', repoPath: 'acme/app', path: '' })

        expect(calls.length).toBe(2)
        expect(new URL(calls[0].url).searchParams.has('path')).toBe(false)
        expect(entries.length).toBe(101)
        expect(entries[100]).toEqual({ name: 'AGENTS.md', path: 'AGENTS.md', type: 'file' })
    })

    it('throws with the status when a folder cannot be listed', async () => {
        stubFetch(() => json({ message: '404 Project Not Found' }, 404))
        await expect(
            gitlab.listDir({ token: 'tok', repoPath: 'acme/secret', path: '' })
        ).rejects.toMatchObject({ name: 'GitProviderError', status: 404 })
    })

    it('reads a text file', async () => {
        const text = '---\nname: deploy\n---\nship it \u2713\n'
        const calls = stubFetch(() =>
            json({
                file_name: 'SKILL.md',
                size: Buffer.byteLength(text),
                encoding: 'base64',
                content: Buffer.from(text).toString('base64'),
            })
        )

        const file = await gitlab.readTextFile({
            token: 'tok',
            repoPath: 'acme/tools/app',
            path: '.december/skills/deploy/SKILL.md',
            maxBytes: 64 * 1024,
        })

        // HEAD is the default branch
        expect(calls[0].url).toBe(
            'https://gitlab.com/api/v4/projects/acme%2Ftools%2Fapp/repository/files/.december%2Fskills%2Fdeploy%2FSKILL.md?ref=HEAD'
        )
        expect(file).toEqual({ size: 33, content: text })
    })

    it('does not return a file that is over the size cap', async () => {
        stubFetch(() => json({ size: 70_000, encoding: 'base64', content: 'aGVsbG8=' }))
        const file = await gitlab.readTextFile({
            token: 'tok',
            repoPath: 'acme/app',
            path: 'big.md',
            maxBytes: 64 * 1024,
        })
        expect(file).toEqual({ size: 70_000, content: null })
    })

    it('throws with the status when a file cannot be read', async () => {
        stubFetch(() => json({ message: '404 File Not Found' }, 404))
        await expect(
            gitlab.readTextFile({ token: 'tok', repoPath: 'acme/app', path: 'x.md', maxBytes: 10 })
        ).rejects.toMatchObject({ name: 'GitProviderError', status: 404 })
    })

    describe('oauth', () => {
        it('builds the authorize url', () => {
            const url = new URL(
                gitlabOAuth.getAuthorizeUrl({
                    clientId: 'id',
                    redirectUri: 'https://api/cb',
                    state: 'xyz',
                })
            )
            expect(url.origin + url.pathname).toBe('https://gitlab.com/oauth/authorize')
            expect(Object.fromEntries(url.searchParams)).toEqual({
                client_id: 'id',
                redirect_uri: 'https://api/cb',
                response_type: 'code',
                scope: 'api read_user',
                state: 'xyz',
            })
        })

        it('exchanges a code for tokens', async () => {
            const calls = stubFetch(() =>
                json({ access_token: 'a', refresh_token: 'r', expires_in: 7200 })
            )
            const tokens = await gitlabOAuth.exchangeCode({
                code: 'c',
                clientId: 'id',
                clientSecret: 's',
                redirectUri: 'https://api/cb',
            })
            expect(bodyOf(calls[0])).toEqual({
                client_id: 'id',
                client_secret: 's',
                code: 'c',
                grant_type: 'authorization_code',
                redirect_uri: 'https://api/cb',
            })
            expect(tokens.accessToken).toBe('a')
        })

        it('reads the signed-in user', async () => {
            const calls = stubFetch(() => json({ id: 77, username: 'jo' }))
            expect(await gitlabOAuth.getUser({ token: 't' })).toEqual({
                id: '77',
                username: 'jo',
            })
            expect(calls[0].url).toBe('https://gitlab.com/api/v4/user')
        })
    })
})
