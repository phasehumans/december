import { spawnSync } from 'node:child_process'

import { getDecemberServerUrl } from './december-credits'

/**
 * /github: shows the current repository and whether the December GitHub App is
 * installed on it. The check uses the signed-in December account.
 */

const REQUEST_TIMEOUT_MS = 8000

export type GithubAppState =
    | 'installed'
    | 'not_installed'
    | 'not_on_repo'
    | 'signed_out'
    | 'no_repo'
    | 'error'

export interface GithubAppStatus {
    /** owner/name of the GitHub repository in this folder */
    repo?: string
    inGitRepo: boolean
    state: GithubAppState
    /** GitHub account or organization the app is installed on */
    accountLogin?: string
    error?: string
    installUrl: string
}

/** same install page the web app opens (apps/web profile api, getGithubConnectUrl) */
export function getGithubAppInstallUrl(appName?: string): string {
    const name = appName || process.env.GITHUB_APP_NAME || 'trydecember'
    return `https://github.com/apps/${name}/installations/new`
}

/** `owner/name` from a GitHub remote URL (https, ssh, or scp style), else undefined */
export function parseGithubRemote(url: string): string | undefined {
    const trimmed = url.trim()
    const match =
        trimmed.match(/^(?:https?|ssh|git):\/\/(?:[^@/]+@)?github\.com(?::\d+)?\/(.+)$/i) ||
        trimmed.match(/^(?:[^@/]+@)?github\.com:(.+)$/i)
    if (!match) return undefined
    const parts = match[1]!
        .replace(/\/+$/, '')
        .replace(/\.git$/i, '')
        .split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined
    return `${parts[0]}/${parts[1]}`
}

function runGit(args: string[], cwd: string): string | undefined {
    const res = spawnSync('git', args, {
        cwd,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
    })
    return res.status === 0 ? res.stdout.trim() : undefined
}

/** reads the GitHub repository from the `origin` remote, or the first GitHub remote */
export function readGitRepository(cwd: string): { inGitRepo: boolean; repo?: string } {
    if (!runGit(['rev-parse', '--show-toplevel'], cwd)) return { inGitRepo: false }
    const remotes = (runGit(['remote'], cwd) || '').split('\n').filter(Boolean)
    const ordered = remotes.includes('origin')
        ? ['origin', ...remotes.filter((r) => r !== 'origin')]
        : remotes
    for (const remote of ordered) {
        const url = runGit(['remote', 'get-url', remote], cwd)
        const repo = url ? parseGithubRemote(url) : undefined
        if (repo) return { inGitRepo: true, repo }
    }
    return { inGitRepo: true }
}

export interface GithubAppStatusInput {
    inGitRepo: boolean
    repo?: string
    token?: string
    fetchImpl?: typeof fetch
}

async function getJson(fetchImpl: typeof fetch, url: string, token: string) {
    const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (res.status === 401) return { unauthorized: true as const }
    if (!res.ok) throw new Error(`The server returned ${res.status}.`)
    const body: any = await res.json()
    return { data: body?.data ?? body }
}

/**
 * Asks the server (GET /githubapp/status, then GET /githubapp/repos) whether the
 * signed-in account has the app installed and whether the installation can see `repo`.
 */
export async function getGithubAppStatus(input: GithubAppStatusInput): Promise<GithubAppStatus> {
    const { inGitRepo, repo, token, fetchImpl = fetch } = input
    const base = { repo, inGitRepo, installUrl: getGithubAppInstallUrl() }
    if (!repo) return { ...base, state: 'no_repo' }
    if (!token) return { ...base, state: 'signed_out' }

    const api = `${getDecemberServerUrl()}/api/v1/githubapp`
    try {
        const status = await getJson(fetchImpl, `${api}/status`, token)
        if ('unauthorized' in status) return { ...base, state: 'signed_out' }
        if (!status.data?.installed) return { ...base, state: 'not_installed' }
        const accountLogin: string | undefined = status.data.accountLogin || undefined

        const name = repo.split('/')[1]!
        const repos = await getJson(
            fetchImpl,
            `${api}/repos?search=${encodeURIComponent(name)}`,
            token
        )
        if ('unauthorized' in repos) return { ...base, state: 'signed_out' }
        const list: { fullName?: string }[] = Array.isArray(repos.data) ? repos.data : []
        const found = list.some((r) => r.fullName?.toLowerCase() === repo.toLowerCase())
        return { ...base, accountLogin, state: found ? 'installed' : 'not_on_repo' }
    } catch (err: any) {
        return { ...base, state: 'error', error: err?.message || String(err) }
    }
}
