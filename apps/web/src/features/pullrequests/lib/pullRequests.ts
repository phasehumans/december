import type { BackendSession } from '@/features/sessions/api/session'

// pull requests come from the sessions list: a session keeps the number and state of the
// pull request it opened. the list has no pull request title, link or line counts yet.

export type PullRequestState = 'open' | 'draft' | 'merged' | 'closed'

export interface PullRequestRow {
    sessionId: string
    title: string
    /** owner/name, when the session has a repository */
    repo: string | null
    number: number
    state: PullRequestState
    /** the branch the pull request was opened from, when known */
    branch: string | null
    /** link to the pull request on GitHub, when the repository url is known */
    url: string | null
    updatedAt: string
    /** when the session was created. a pull request has no opened date saved */
    createdAt: string
    /** tags of the session */
    tags: string[]
}

export const PULL_REQUEST_STATE_LABELS: Record<PullRequestState, string> = {
    open: 'Open',
    draft: 'Draft',
    merged: 'Merged',
    closed: 'Closed',
}

const cleanRepoUrl = (repoUrl: string) => repoUrl.replace(/\.git$/, '').replace(/\/+$/, '')

/** owner/name of the session repository, or null */
export const repoNameOf = (session: BackendSession): string | null => {
    if (session.githubRepoName) return session.githubRepoName
    if (!session.repoUrl) return null
    const match = /github\.com[/:]([\w.-]+\/[\w.-]+)/i.exec(cleanRepoUrl(session.repoUrl))
    return match ? match[1] : null
}

/** the saved pull request link, else one built from the repository url */
export const pullRequestUrlOf = (session: BackendSession): string | null => {
    if (!session.prNumber) return null
    if (session.prUrl) return session.prUrl
    return session.repoUrl ? `${cleanRepoUrl(session.repoUrl)}/pull/${session.prNumber}` : null
}

/** sessions that opened a pull request, newest first */
export const toPullRequestRows = (sessions: BackendSession[]): PullRequestRow[] =>
    sessions
        .filter((session) => session.prNumber != null && session.type !== 'SEARCH')
        .map((session) => ({
            sessionId: session.id,
            title: session.title || session.projectName || 'Untitled session',
            repo: repoNameOf(session),
            number: session.prNumber as number,
            state: session.prState ?? 'open',
            branch: session.prBranch ?? session.branch ?? null,
            url: pullRequestUrlOf(session),
            updatedAt: session.updatedAt,
            createdAt: session.createdAt,
            tags: session.tags || [],
        }))
        .sort(
            (a, b) =>
                (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0)
        )

/** a draft is still open, so it shows under Open */
export const isOpenPullRequest = (row: PullRequestRow): boolean =>
    row.state === 'open' || row.state === 'draft'

/** matches the title, repository, branch or number */
export const searchPullRequests = (rows: PullRequestRow[], query: string): PullRequestRow[] => {
    const needle = query.trim().toLowerCase().replace(/^#/, '')
    if (!needle) return rows
    return rows.filter((row) =>
        [row.title, row.repo, row.branch, String(row.number)].some((value) =>
            (value || '').toLowerCase().includes(needle)
        )
    )
}

export const PULL_REQUEST_STATE_CLASS: Record<PullRequestState, string> = {
    open: 'text-emerald-400',
    draft: 'text-[#8F8E8D]',
    merged: 'text-[#C084FC]',
    closed: 'text-red-400',
}
