import { createIssueComment } from '../utils/github'

import { GitProviderError, PULL_REQUEST_READ_TIMEOUT_MS, decodeRepoFile } from './types'

import type { CiStatus, GitProvider, GitRepo, PullRequest, RepoDirEntry, TokenSet } from './types'

const API = 'https://api.github.com'
// https, git@host:path and ssh://git@host/path
const REPO_URL =
    /^(?:https?:\/\/(?:www\.)?|git@|ssh:\/\/git@)github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i

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
    mergedAt: pr.merged_at ?? null,
    closedAt: pr.closed_at ?? null,
    ...(pr.base?.repo?.id != null ? { repoId: String(pr.base.repo.id) } : {}),
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
    const { token, repoPath, title, head, base, body, draft } = data
    const owner = repoPath.split('/')[0]

    // a network error is handled like a refused request: the caller gets null
    const open = (asDraft: boolean) =>
        fetch(`${API}/repos/${repoPath}/pulls`, {
            method: 'POST',
            headers: { ...headers(token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, head, base, body, ...(asDraft ? { draft: true } : {}) }),
        }).catch(() => null)

    const createRes = await open(Boolean(draft))

    if (createRes?.status === 201) {
        return toPullRequest(await createRes.json())
    }

    // 422: a pull request for this head branch is already open
    if (createRes?.status === 422) {
        // a network error here also gives null
        const listRes = await fetch(
            `${API}/repos/${repoPath}/pulls?head=${owner}:${head}&state=all`,
            { headers: headers(token) }
        ).catch(() => null)

        if (listRes?.ok) {
            const list = (await listRes.json()) as any[]
            if (list?.length) return toPullRequest(list[0])
        }

        // 422 with no pull request for the branch: the repository's plan has no drafts.
        // a ready pull request is better than none
        if (draft) {
            const readyRes = await open(false)
            if (readyRes?.status === 201) return toPullRequest(await readyRes.json())
        }
    }

    return null
}

const getPullRequest: GitProvider['getPullRequest'] = async (data) => {
    const { token, repoPath, number } = data
    const res = await fetch(`${API}/repos/${repoPath}/pulls/${number}`, {
        headers: headers(token),
        signal: AbortSignal.timeout(PULL_REQUEST_READ_TIMEOUT_MS),
    }).catch(() => null)
    if (!res?.ok) return null
    return toPullRequest(await res.json())
}

const getCiStatus: GitProvider['getCiStatus'] = async (data) => {
    const { token, repoPath, sha } = data
    // no answer keeps the default status, as before the provider layer
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

// a path in the url of the contents api: every part is encoded, the slashes stay
const contentsUrl = (repoPath: string, path: string) =>
    `${API}/repos/${repoPath}/contents/${path.split('/').map(encodeURIComponent).join('/')}`

const listDir: GitProvider['listDir'] = async (data) => {
    const { token, repoPath, path } = data
    // no ref: github answers for the default branch
    const res = await fetch(contentsUrl(repoPath, path), { headers: headers(token) })
    if (!res.ok) {
        throw new GitProviderError(`Failed to list ${path || 'the repository'}`, res.status)
    }
    const body = (await res.json()) as any
    // a file answers with one object, not a list
    if (!Array.isArray(body)) return []
    const entries: RepoDirEntry[] = []
    for (const item of body) {
        if (item?.type !== 'file' && item?.type !== 'dir') continue
        entries.push({ name: String(item.name), path: String(item.path), type: item.type })
    }
    return entries
}

const readTextFile: GitProvider['readTextFile'] = async (data) => {
    const { token, repoPath, path, maxBytes } = data
    const res = await fetch(contentsUrl(repoPath, path), { headers: headers(token) })
    if (!res.ok) {
        throw new GitProviderError(`Failed to read ${path}`, res.status)
    }
    const body = (await res.json()) as any
    if (Array.isArray(body) || body?.type !== 'file') {
        throw new GitProviderError(`${path} is not a file`, 404)
    }
    const size = Number(body.size) || 0
    // github sends no content for a file over 1 MB, so the size is checked first
    if (size > maxBytes || body.encoding !== 'base64') return { size, content: null }
    return decodeRepoFile(String(body.content ?? ''), maxBytes)
}

const hasBranch: GitProvider['hasBranch'] = async (data) => {
    const { token, repoPath, branch } = data
    // every part of the branch name is encoded, the slashes stay
    const name = branch.split('/').map(encodeURIComponent).join('/')
    const res = await fetch(`${API}/repos/${repoPath}/branches/${name}`, {
        headers: headers(token),
    })
    if (res.status === 404) return false
    if (!res.ok) {
        throw new GitProviderError(`Failed to read the branch ${branch}`, res.status)
    }
    return true
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
    // a body that is not json is handled like an empty one: the check below fails
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

const getUser: GitProvider['getUser'] = async (data) => {
    const { token } = data
    // a network error is handled like a refused token
    const res = await fetch(`${API}/user`, { headers: headers(token) }).catch(() => null)
    if (!res?.ok) return null
    // a body that is not json is handled like no answer
    const user = (await res.json().catch(() => null)) as any
    if (!user?.login) return null
    return {
        id: String(user.id ?? ''),
        login: user.login,
        name: user.name ?? null,
        email: user.email ?? null,
    }
}

export const githubProvider: GitProvider = {
    name: 'GITHUB',
    getUser,
    parseRepoUrl,
    getCloneUrl,
    listRepos,
    createPullRequest,
    getPullRequest,
    getCiStatus,
    comment,
    listDir,
    readTextFile,
    hasBranch,
    refreshToken,
}
