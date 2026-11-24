import { createIssueComment } from '../utils/github'

import { GitProviderError } from './types'

import type { CiStatus, GitProvider, GitRepo, PullRequest, TokenSet } from './types'

const API = 'https://api.github.com'
const REPO_URL = /^https?:\/\/(?:www\.)?github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i

const headers = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'December-App',
})

const toRepo = (repo: any): GitRepo => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    language: repo.language ?? null,
    description: repo.description ?? null,
    owner: {
        login: repo.owner?.login,
        avatarUrl: repo.owner?.avatar_url,
    },
    provider: 'GITHUB',
})

const toPullRequest = (pr: any): PullRequest => ({
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    state: pr.state,
    status: pr.merged_at
        ? 'merged'
        : pr.draft
          ? 'draft'
          : pr.state === 'closed'
            ? 'closed'
            : 'open',
    headSha: pr.head?.sha,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
})

const parseRepoUrl: GitProvider['parseRepoUrl'] = (url) => {
    const match = url.trim().match(REPO_URL)
    const owner = match?.[1]
    const name = match?.[2]
    if (!owner || !name) return null
    return { owner, name, path: `${owner}/${name}` }
}

const getCloneUrl: GitProvider['getCloneUrl'] = (data) => {
    const { token, repoPath } = data
    return `https://x-access-token:${token}@github.com/${repoPath}.git`
}

const listRepos: GitProvider['listRepos'] = async (data) => {
    const { token, page: requestedPage, limit, search } = data
    const perPage = limit ? Math.min(limit, 100) : 100
    const query = search?.toLowerCase()
    let page = requestedPage || 1
    let repos: any[] = []

    for (;;) {
        const response = await fetch(
            `${API}/user/repos?sort=updated&per_page=${perPage}&page=${page}`,
            { method: 'GET', headers: headers(token) }
        )

        if (!response.ok) {
            const errorText = await response.text()
            throw new GitProviderError(
                `Failed to fetch GitHub repos: ${errorText}`,
                response.status
            )
        }

        const pageRepos = (await response.json()) as any[]
        repos = repos.concat(
            query
                ? pageRepos.filter(
                      (r) =>
                          r.name?.toLowerCase().includes(query) ||
                          r.full_name?.toLowerCase().includes(query)
                  )
                : pageRepos
        )

        if (pageRepos.length < perPage || requestedPage !== undefined) break
        page++
    }

    return repos.map(toRepo)
}

const createPullRequest: GitProvider['createPullRequest'] = async (data) => {
    const { token, repoPath, title, head, base, body } = data
    const owner = repoPath.split('/')[0]

    const createRes = await fetch(`${API}/repos/${repoPath}/pulls`, {
        method: 'POST',
        headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, head, base, body }),
    }).catch(() => null)

    if (createRes?.status === 201) {
        return toPullRequest(await createRes.json())
    }

    // 422: a pull request for this head branch is already open
    if (createRes?.status === 422) {
        const listRes = await fetch(
            `${API}/repos/${repoPath}/pulls?head=${owner}:${head}&state=all`,
            { headers: headers(token) }
        ).catch(() => null)

        if (listRes?.ok) {
            const list = (await listRes.json()) as any[]
            return list?.length ? toPullRequest(list[0]) : null
        }
    }

    return null
}

const getCiStatus: GitProvider['getCiStatus'] = async (data) => {
    const { token, repoPath, sha } = data
    const res = await fetch(`${API}/repos/${repoPath}/commits/${sha}/check-runs`, {
        headers: headers(token),
    }).catch(() => null)

    let status: CiStatus = 'passing'
    if (!res?.ok) return status

    const runs: any[] = ((await res.json()) as any).check_runs || []
    if (runs.some((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out')) {
        status = 'failed'
    } else if (runs.some((r) => r.status === 'in_progress' || r.status === 'queued')) {
        status = 'pending'
    }
    return status
}

const comment: GitProvider['comment'] = async (data) => {
    const { token, repoPath, issueNumber, body } = data
    const [owner = '', repo = ''] = repoPath.split('/')
    await createIssueComment({ token, owner, repo, issueNumber, body })
}

// for github app user tokens that expire; classic oauth tokens never need it
const refreshToken: GitProvider['refreshToken'] = async (data) => {
    const { refreshToken: token, clientId, clientSecret } = data
    const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: token,
        }),
    })
    const body = (await res.json().catch(() => ({}))) as any
    if (!res.ok || !body.access_token) {
        throw new GitProviderError('Failed to refresh the GitHub token', res.ok ? 400 : res.status)
    }
    const tokens: TokenSet = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? null,
        expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    }
    return tokens
}

export const githubProvider: GitProvider = {
    name: 'GITHUB',
    parseRepoUrl,
    getCloneUrl,
    listRepos,
    createPullRequest,
    getCiStatus,
    comment,
    refreshToken,
}
