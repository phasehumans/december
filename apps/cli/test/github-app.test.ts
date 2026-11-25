import { describe, expect, it } from 'bun:test'

import { getGithubAppStatus, parseGithubRemote } from '../src/utils/github-app'

function fakeFetch(routes: Record<string, { status?: number; body?: unknown }>) {
    const calls: string[] = []
    const impl = (async (url: string) => {
        calls.push(url)
        const key = Object.keys(routes).find((k) => url.includes(k))
        const route = key ? routes[key]! : { status: 404 }
        const status = route.status ?? 200
        return new Response(JSON.stringify(route.body ?? {}), { status })
    }) as unknown as typeof fetch
    return { impl, calls }
}

describe('/github app status', () => {
    it('reads owner/name from GitHub remotes', () => {
        expect(parseGithubRemote('https://github.com/acme/web.git')).toBe('acme/web')
        expect(parseGithubRemote('https://github.com/acme/web')).toBe('acme/web')
        expect(parseGithubRemote('git@github.com:acme/web.git')).toBe('acme/web')
        expect(parseGithubRemote('ssh://git@github.com/acme/web.git')).toBe('acme/web')
        expect(parseGithubRemote('https://gitlab.com/acme/web.git')).toBeUndefined()
        expect(parseGithubRemote('https://github.com/acme')).toBeUndefined()
    })

    it('does not call the server without a repository or a token', async () => {
        const { impl, calls } = fakeFetch({})
        const noRepo = await getGithubAppStatus({ inGitRepo: false, token: 't', fetchImpl: impl })
        expect(noRepo.state).toBe('no_repo')
        const signedOut = await getGithubAppStatus({
            inGitRepo: true,
            repo: 'acme/web',
            fetchImpl: impl,
        })
        expect(signedOut.state).toBe('signed_out')
        expect(signedOut.installUrl).toContain('/installations/new')
        expect(calls).toEqual([])
    })

    it('reports installed when the installation can see the repository', async () => {
        const { impl, calls } = fakeFetch({
            '/githubapp/status': { body: { data: { installed: true, accountLogin: 'acme' } } },
            '/githubapp/repos': { body: { data: [{ fullName: 'Acme/Web' }] } },
        })
        const status = await getGithubAppStatus({
            inGitRepo: true,
            repo: 'acme/web',
            token: 't',
            fetchImpl: impl,
        })
        expect(status.state).toBe('installed')
        expect(status.accountLogin).toBe('acme')
        expect(calls[1]).toContain('/githubapp/repos?search=web')
    })

    it('reports not_on_repo, not_installed, signed_out, and error', async () => {
        const input = { inGitRepo: true, repo: 'acme/web', token: 't' }
        const notOnRepo = fakeFetch({
            '/githubapp/status': { body: { data: { installed: true } } },
            '/githubapp/repos': { body: { data: [{ fullName: 'acme/api' }] } },
        })
        expect((await getGithubAppStatus({ ...input, fetchImpl: notOnRepo.impl })).state).toBe(
            'not_on_repo'
        )
        const notInstalled = fakeFetch({
            '/githubapp/status': { body: { data: { installed: false } } },
        })
        expect((await getGithubAppStatus({ ...input, fetchImpl: notInstalled.impl })).state).toBe(
            'not_installed'
        )
        const expired = fakeFetch({ '/githubapp/status': { status: 401 } })
        expect((await getGithubAppStatus({ ...input, fetchImpl: expired.impl })).state).toBe(
            'signed_out'
        )
        const broken = fakeFetch({ '/githubapp/status': { status: 500 } })
        const error = await getGithubAppStatus({ ...input, fetchImpl: broken.impl })
        expect(error.state).toBe('error')
        expect(error.error).toContain('500')
    })
})
