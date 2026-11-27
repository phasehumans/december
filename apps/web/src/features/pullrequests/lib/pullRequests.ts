import type { BackendPullRequest, BackendSession } from '@/features/sessions/api/session'

// pull requests come from GET /session/pull-requests: one row for each session that
// opened a pull request, with the title, link, line counts and dates the server saved.

export type PullRequestState = 'open' | 'draft' | 'merged' | 'closed'

export interface PullRequestRow {
    sessionId: string
    /** the host of the repository: the link names it */
    gitProvider: 'GITHUB' | 'GITLAB'
    title: string
    /** owner/name, when the session has a repository */
    repo: string | null
    number: number
    state: PullRequestState
    /** the branch the pull request was opened from, when known */
    branch: string | null
    /** link to the pull request on the host, when it is a web link */
    url: string | null
    /** added and deleted lines, when the host counts them (GitLab does not) */
    additions: number | null
    deletions: number | null
    /** the last change of the pull request on the host; the session date when not known */
    updatedAt: string
    /** when the pull request was opened; the session date for rows saved before that */
    createdAt: string
    /** tags of the session */
    tags: string[]
    /** the run state of the session (RUNNING, PROVISIONING, ...), when known */
    vmStatus: string | null
    isArchived: boolean
    /** when the session was pinned, so the undo of an archive puts the pin back */
    pinnedAt: string | null
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

// only web links reach an href or window.open: never javascript: or file:
export const webLinkOrNull = (url: string | null | undefined): string | null =>
    url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null

/** the saved pull request link, else one built from the repository url */
export const pullRequestUrlOf = (session: BackendSession): string | null => {
    if (!session.prNumber) return null
    if (session.prUrl) return webLinkOrNull(session.prUrl)
    return session.repoUrl
        ? webLinkOrNull(`${cleanRepoUrl(session.repoUrl)}/pull/${session.prNumber}`)
        : null
}

/** rows of the pull requests list, in the order the server sorted them */
const firstOfEachSession = (pullRequests: BackendPullRequest[]): BackendPullRequest[] => {
    const seen = new Set<string>()
    return pullRequests.filter((pr) => {
        if (seen.has(pr.sessionId)) return false
        seen.add(pr.sessionId)
        return true
    })
}

export const toPullRequestRows = (pullRequests: BackendPullRequest[]): PullRequestRow[] =>
    // each session once: a row that moved between two pages is not shown twice
    firstOfEachSession(pullRequests).map((pr) => ({
        sessionId: pr.sessionId,
        gitProvider: pr.gitProvider === 'GITLAB' ? 'GITLAB' : 'GITHUB',
        title: pr.prTitle || pr.title || 'Untitled session',
        repo: pr.repo,
        number: pr.prNumber,
        state: pr.prState ?? 'open',
        branch: pr.prBranch,
        url: webLinkOrNull(pr.prUrl),
        additions: pr.additions,
        deletions: pr.deletions,
        updatedAt: pr.prUpdatedAt ?? pr.updatedAt,
        createdAt: pr.prOpenedAt ?? pr.createdAt,
        tags: pr.tags || [],
        vmStatus: pr.vmStatus ?? null,
        isArchived: Boolean(pr.isArchived),
        pinnedAt: pr.pinnedAt ?? null,
    }))

/**
 * the row in the shape the session menu helpers read (useSessionLinks): the pull request
 * link, and the repository and branch for "New in this repo"
 */
export const pullRequestRowAsSession = (row: PullRequestRow): BackendSession => ({
    id: row.sessionId,
    title: row.title,
    type: 'WEB',
    lastMessage: null,
    gitProvider: row.gitProvider,
    githubRepoName: row.repo,
    branch: row.branch,
    prNumber: row.number,
    prState: row.state,
    prUrl: row.url,
    prBranch: row.branch,
    tags: row.tags,
    vmStatus: row.vmStatus,
    isArchived: row.isArchived,
    isPinned: Boolean(row.pinnedAt),
    pinnedAt: row.pinnedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
})

/** the name of the host, for link labels */
export const GIT_HOST_LABELS: Record<PullRequestRow['gitProvider'], string> = {
    GITHUB: 'GitHub',
    GITLAB: 'GitLab',
}

export const PULL_REQUEST_STATE_CLASS: Record<PullRequestState, string> = {
    open: 'text-emerald-400',
    draft: 'text-[#8F8E8D]',
    merged: 'text-[#C084FC]',
    closed: 'text-red-400',
}
