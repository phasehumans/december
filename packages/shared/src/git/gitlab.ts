import { GitProviderError } from './types'

import type { CiStatus, GitProvider, GitRepo, OAuthApp, PullRequest, TokenSet } from './types'

// gitlab.com only for now; self-managed hosts come later (#627)
const HOST = 'https://gitlab.com'
const API = `${HOST}/api/v4`
const SCOPES = 'api read_user'
const CALLBACK_PATH = '/api/v1/integrations/gitlab/callback'
const REPO_URL = /^https?:\/\/(?:www\.)?gitlab\.com\/((?:[\w.-]+\/)+)([\w.-]+?)(?:\.git)?\/?$/i

const headers = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'December-App',
})

const projectUrl = (repoPath: string) => `${API}/projects/${encodeURIComponent(repoPath)}`

const toRepo = (project: any): GitRepo => ({
    id: project.id,
    name: project.path,
    fullName: project.path_with_namespace,
    private: project.visibility !== 'public',
    defaultBranch: project.default_branch || 'main',
    updatedAt: project.last_activity_at,
    htmlUrl: project.web_url,
    cloneUrl: project.http_url_to_repo,
    language: null,
    description: project.description ?? null,
    owner: {
        login: project.namespace?.full_path,
        avatarUrl: project.namespace?.avatar_url ?? '',
    },
    provider: 'GITLAB',
})

const toPullRequest = (mr: any): PullRequest => {
    const changed = Number.parseInt(String(mr.changes_count ?? ''), 10)
    return {
        number: mr.iid,
        url: mr.web_url,
        title: mr.title,
        // github's word for an open request, so the web shows both the same way
        state: mr.state === 'opened' ? 'open' : mr.state,
        status:
            mr.state === 'merged'
                ? 'merged'
                : mr.state === 'closed' || mr.state === 'locked'
                  ? 'closed'
                  : mr.draft
                    ? 'draft'
                    : 'open',
        headSha: mr.sha,
        // gitlab does not count added and deleted lines on a merge request
        additions: 0,
        deletions: 0,
        changedFiles: Number.isNaN(changed) ? undefined : changed,
        createdAt: mr.created_at,
        updatedAt: mr.updated_at,
    }
}

const requestToken = async (body: Record<string, string>, what: string): Promise<TokenSet> => {
    const res = await fetch(`${HOST}/oauth/token`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as any
    if (!res.ok || !data.access_token) {
        throw new GitProviderError(`GitLab refused to ${what}`, res.ok ? 400 : res.status)
    }
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    }
}

const parseRepoUrl: GitProvider['parseRepoUrl'] = (url) => {
    const match = url.trim().match(REPO_URL)
    const owner = match?.[1]?.replace(/\/$/, '')
    const name = match?.[2]
    if (!owner || !name) return null
    return { owner, name, path: `${owner}/${name}` }
}

const getCloneUrl: GitProvider['getCloneUrl'] = (data) => {
    const { token, repoPath } = data
    return `https://oauth2:${token}@gitlab.com/${repoPath}.git`
}

const listRepos: GitProvider['listRepos'] = async (data) => {
    const { token, page: requestedPage, limit, search } = data
    const perPage = limit ? Math.min(limit, 100) : 100
    let page = requestedPage || 1
    let projects: any[] = []

    for (;;) {
        const params = new URLSearchParams({
            membership: 'true',
            order_by: 'last_activity_at',
            sort: 'desc',
            per_page: String(perPage),
            page: String(page),
        })
        if (search) {
            params.set('search', search)
            params.set('search_namespaces', 'true')
        }

        const response = await fetch(`${API}/projects?${params.toString()}`, {
            headers: headers(token),
        })
        if (!response.ok) {
            const errorText = await response.text()
            throw new GitProviderError(
                `Failed to fetch GitLab projects: ${errorText}`,
                response.status
            )
        }

        const pageProjects = (await response.json()) as any[]
        projects = projects.concat(pageProjects)

        if (pageProjects.length < perPage || requestedPage !== undefined) break
        page++
    }

    return projects.map(toRepo)
}

const createPullRequest: GitProvider['createPullRequest'] = async (data) => {
    const { token, repoPath, title, head, base, body } = data

    const createRes = await fetch(`${projectUrl(repoPath)}/merge_requests`, {
        method: 'POST',
        headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source_branch: head,
            target_branch: base,
            title,
            description: body,
        }),
    }).catch(() => null)

    if (createRes?.status === 201) {
        return toPullRequest(await createRes.json())
    }

    // 409: a merge request for this source branch is already open
    if (createRes?.status === 409) {
        const params = new URLSearchParams({ source_branch: head })
        const listRes = await fetch(`${projectUrl(repoPath)}/merge_requests?${params}`, {
            headers: headers(token),
        }).catch(() => null)

        if (listRes?.ok) {
            const list = (await listRes.json()) as any[]
            return list?.length ? toPullRequest(list[0]) : null
        }
    }

    return null
}

const getCiStatus: GitProvider['getCiStatus'] = async (data) => {
    const { token, repoPath, sha } = data
    const res = await fetch(`${projectUrl(repoPath)}/pipelines?sha=${sha}&per_page=1`, {
        headers: headers(token),
    }).catch(() => null)

    let status: CiStatus = 'passing'
    if (!res?.ok) return status

    const latest = ((await res.json()) as any[])[0]?.status
    if (latest === 'failed' || latest === 'canceled') {
        status = 'failed'
    } else if (latest && !['success', 'skipped', 'manual'].includes(latest)) {
        status = 'pending'
    }
    return status
}

const comment: GitProvider['comment'] = async (data) => {
    const { token, repoPath, issueNumber, body } = data
    const res = await fetch(`${projectUrl(repoPath)}/issues/${issueNumber}/notes`, {
        method: 'POST',
        headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    })
    if (!res.ok) {
        throw new GitProviderError(`Failed to comment on GitLab (${res.status})`, res.status)
    }
}

const refreshToken: GitProvider['refreshToken'] = async (data) => {
    const { refreshToken: token, clientId, clientSecret, redirectUri } = data
    return requestToken(
        {
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: token,
            grant_type: 'refresh_token',
            redirect_uri: redirectUri,
        },
        'refresh the token'
    )
}

export const gitlabProvider: GitProvider = {
    name: 'GITLAB',
    parseRepoUrl,
    getCloneUrl,
    listRepos,
    createPullRequest,
    getCiStatus,
    comment,
    refreshToken,
}

// connecting an account (the server's oauth routes)
const getAuthorizeUrl = (data: { clientId: string; redirectUri: string; state: string }) => {
    const { clientId, redirectUri, state } = data
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        state,
    })
    return `${HOST}/oauth/authorize?${params.toString()}`
}

const exchangeCode = async (data: OAuthApp & { code: string }): Promise<TokenSet> => {
    const { code, clientId, clientSecret, redirectUri } = data
    return requestToken(
        {
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
        },
        'sign in'
    )
}

const getUser = async (data: { token: string }): Promise<{ id: string; username: string }> => {
    const { token } = data
    const res = await fetch(`${API}/user`, { headers: headers(token) })
    if (!res.ok) {
        throw new GitProviderError('Failed to read the GitLab user', res.status)
    }
    const user = (await res.json()) as any
    return { id: String(user.id), username: user.username }
}

// the redirect uri registered on the gitlab app. a refresh must send the same one as the
// sign-in, so the server and the worker both build it here.
const getCallbackUrl = (serverUrl: string) => `${serverUrl.replace(/\/+$/, '')}${CALLBACK_PATH}`

export const gitlabOAuth = {
    getCallbackUrl,
    getAuthorizeUrl,
    exchangeCode,
    getUser,
}
