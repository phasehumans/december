import type { GithubRepo } from '@/features/profile/api/profile'
import type { BackendSession } from '@/features/sessions/api/session'

import { requestHomePrefill } from '@/features/home/prefill'
import { NEW_SESSION_REQUEST_EVENT } from '@/shared/lib/appEvents'

// where a session can take you from a list: its own page, a new browser tab, and a new
// session in the same repository. the row menus and the row links share these.

/** the app path of a session. the id always opens the right one, a title slug can clash */
export const sessionPath = (sessionId: string): string => `/sessions/${sessionId}`

/** true for a click the browser must handle itself: a new tab or a new window */
export const isNewTabClick = (event: {
    button: number
    metaKey: boolean
    ctrlKey: boolean
    shiftKey: boolean
    altKey: boolean
}): boolean =>
    event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

export const openSessionInNewTab = (sessionId: string): void => {
    window.open(sessionPath(sessionId), '_blank', 'noopener')
}

/** opens a page of another site (the pull request on GitHub) */
export const openExternal = (url: string): void => {
    window.open(url, '_blank', 'noopener,noreferrer')
}

const ownerAndName = (session: BackendSession): { owner: string; name: string } | null => {
    if (session.repoUrl) {
        const url = session.repoUrl
            .trim()
            .replace(/\/+$/, '')
            .replace(/\.git$/, '')
        const match = /github\.com[/:]([\w.-]+)\/([\w.-]+)/i.exec(url)
        if (match) return { owner: match[1], name: match[2] }
    }
    const parts = (session.githubRepoName || '').split('/')
    return parts.length === 2 && parts[0] && parts[1] ? { owner: parts[0], name: parts[1] } : null
}

/**
 * the repository of a session in the shape the Home prompt box takes. the user's own
 * repository list wins when it is loaded and has the repository. else the fields are
 * built from the session url, which is all the prompt box reads.
 */
export const repoOfSession = (
    session: BackendSession,
    known: GithubRepo[] = []
): GithubRepo | null => {
    const parsed = ownerAndName(session)
    if (!parsed) return null
    const fullName = `${parsed.owner}/${parsed.name}`
    const found = known.find((repo) => repo.fullName.toLowerCase() === fullName.toLowerCase())
    if (found) return found
    return {
        id: 0,
        name: parsed.name,
        fullName,
        private: false,
        defaultBranch: session.branch || 'main',
        updatedAt: session.updatedAt,
        htmlUrl: `https://github.com/${fullName}`,
        cloneUrl: `https://github.com/${fullName}.git`,
        language: null,
        description: null,
        owner: { login: parsed.owner, avatarUrl: '' },
    }
}

/** opens Home as a new session with the repository and branch set */
export const startSessionInRepo = (repo: GithubRepo, branch?: string | null): void => {
    window.dispatchEvent(new CustomEvent(NEW_SESSION_REQUEST_EVENT))
    requestHomePrefill({ repo, branch: branch || undefined })
}
