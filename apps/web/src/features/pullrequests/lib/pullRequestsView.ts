import { isOpenPullRequest, type PullRequestRow } from './pullRequests'

import {
    SESSIONS_SORTS,
    shortRepoName,
    type SessionsSort,
} from '@/features/sessions/lib/sessionsView'

// the Pull requests page view: the same sort and filter menu as the Sessions page.
// the All | Open switch in the toolbar is not part of it. the page loads every row at
// once, so the view runs in the browser.

export interface PullRequestsView {
    /** Newest and Oldest go by the opened date of the pull request */
    sort: SessionsSort
    merged: boolean
    closed: boolean
    /** owner/name of one repository, or null for any */
    repo: string | null
    tag: string | null
}

export const DEFAULT_PULL_REQUESTS_VIEW: PullRequestsView = {
    sort: 'updated',
    merged: false,
    closed: false,
    repo: null,
    tag: null,
}

const VIEW_KEY = 'december:pull-requests-view'

const textOrNull = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value : null

/** the saved view, or the default when nothing is saved or storage is blocked */
export const readPullRequestsView = (): PullRequestsView => {
    try {
        const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null')
        if (!saved || typeof saved !== 'object') return DEFAULT_PULL_REQUESTS_VIEW
        return {
            sort: SESSIONS_SORTS.includes(saved.sort) ? saved.sort : 'updated',
            merged: saved.merged === true,
            closed: saved.closed === true,
            repo: textOrNull(saved.repo),
            tag: textOrNull(saved.tag),
        }
    } catch (err) {
        // Intentionally swallowed: storage blocked or bad json, the default view is fine
        return DEFAULT_PULL_REQUESTS_VIEW
    }
}

export const writePullRequestsView = (view: PullRequestsView): void => {
    try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(view))
    } catch (err) {
        // Intentionally swallowed: storage blocked, the view lasts until reload
    }
}

/** names of the filters that are on, in menu order */
export const activePullRequestFilters = (view: PullRequestsView): string[] => {
    const names: string[] = []
    if (view.merged) names.push('Merged')
    if (view.closed) names.push('Closed')
    if (view.repo) names.push(shortRepoName(view.repo))
    if (view.tag) names.push(view.tag)
    return names
}

const time = (iso: string): number => new Date(iso).getTime() || 0

/**
 * the rows of the view. onlyOpen is the All | Open switch. Merged and Closed together
 * show both states.
 */
export const applyPullRequestsView = (
    rows: PullRequestRow[],
    view: PullRequestsView,
    onlyOpen: boolean
): PullRequestRow[] =>
    rows
        .filter((row) => {
            if (onlyOpen && !isOpenPullRequest(row)) return false
            if (view.merged || view.closed) {
                const isPicked =
                    (view.merged && row.state === 'merged') ||
                    (view.closed && row.state === 'closed')
                if (!isPicked) return false
            }
            if (view.repo && row.repo !== view.repo) return false
            if (view.tag && !row.tags.includes(view.tag)) return false
            return true
        })
        .sort((a, b) => {
            if (view.sort === 'updated') return time(b.updatedAt) - time(a.updatedAt)
            return view.sort === 'oldest'
                ? time(a.createdAt) - time(b.createdAt)
                : time(b.createdAt) - time(a.createdAt)
        })

/** repositories and tags of the loaded rows, for the menu lists */
export const pullRequestFacets = (rows: PullRequestRow[]): { repos: string[]; tags: string[] } => {
    const repos = new Set<string>()
    const tags = new Set<string>()
    for (const row of rows) {
        if (row.repo) repos.add(row.repo)
        for (const tag of row.tags) tags.add(tag)
    }
    return { repos: [...repos].sort(), tags: [...tags].sort() }
}
