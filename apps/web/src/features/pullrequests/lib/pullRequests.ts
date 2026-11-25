import type { BackendPullRequest, BackendSession } from '@/features/sessions/api/session'

// pull requests come from GET /session/pull-requests: one row for each session that
// opened a pull request, with the title, link, line counts and dates the server saved.

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
    /** added and deleted lines, when the host counts them (GitLab does not) */
    additions: number | null
    deletions: number | null
    updatedAt: string
    /** when the pull request was opened; the session date for rows saved before that */
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

/** owner/name of the session repository, the name alone when the owner is not known, or null */
export const repoNameOf = (session: BackendSession): string | null => {
    if (session.githubRepoName) {
        // the list sends the owner apart from the name
        return session.githubRepoOwner && !session.githubRepoName.includes('/')
            ? `${session.githubRepoOwner}/${session.githubRepoName}`
            : session.githubRepoName
    }
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

/** rows of the pull requests list, in the order the server sorted them */
export const toPullRequestRows = (pullRequests: BackendPullRequest[]): PullRequestRow[] =>
    pullRequests.map((pr) => ({
        sessionId: pr.sessionId,
        title: pr.prTitle || pr.title || 'Untitled session',
        repo: pr.repo,
        number: pr.prNumber,
        state: pr.prState ?? 'open',
        branch: pr.prBranch,
        url: pr.prUrl,
        additions: pr.additions,
        deletions: pr.deletions,
        updatedAt: pr.updatedAt,
        createdAt: pr.prOpenedAt ?? pr.createdAt,
        tags: pr.tags || [],
    }))

/**
 * rows from the loaded sessions list, for the few rows under the Home prompt box. the
 * Pull requests page reads GET /session/pull-requests instead
 */
export const sessionsToPullRequestRows = (sessions: BackendSession[]): PullRequestRow[] =>
    sessions
        .filter((session) => session.prNumber != null && session.type !== 'SEARCH')
        .map((session) => ({
            sessionId: session.id,
            title: session.prTitle || session.title || session.projectName || 'Untitled session',
            repo: repoNameOf(session),
            number: session.prNumber as number,
            state: session.prState ?? 'open',
            branch: session.prBranch ?? session.branch ?? null,
            url: pullRequestUrlOf(session),
            additions: null,
            deletions: null,
            updatedAt: session.updatedAt,
            createdAt: session.createdAt,
            tags: session.tags || [],
        }))
        .sort(
            (a, b) =>
                (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0)
        )

export const PULL_REQUEST_STATE_CLASS: Record<PullRequestState, string> = {
    open: 'text-emerald-400',
    draft: 'text-[#8F8E8D]',
    merged: 'text-[#C084FC]',
    closed: 'text-red-400',
}
