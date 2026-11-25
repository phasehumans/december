import type { PullRequestsParams } from '@/features/sessions/api/session'

import {
    SESSIONS_SORTS,
    shortRepoName,
    type SessionsSort,
} from '@/features/sessions/lib/sessionsView'

// the Pull requests page view: the same sort and filter menu as the Sessions page.
// the All | Open switch in the toolbar is not part of it. the server filters, sorts and
// pages the rows (GET /session/pull-requests), so the view also covers rows not loaded.

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

/** the filters and the sort of one list request, without the page */
export type PullRequestsViewParams = Pick<
    PullRequestsParams,
    'state' | 'repo' | 'tag' | 'search' | 'sortBy' | 'sortOrder'
>

/**
 * the view as GET /session/pull-requests filters. onlyOpen is the All | Open switch: a
 * draft is still open, so it shows under Open. Merged and Closed together ask for both
 * states. Newest and Oldest sort by the opened date of the pull request.
 */
export const pullRequestsViewParams = (
    view: PullRequestsView,
    onlyOpen: boolean,
    search: string
): PullRequestsViewParams => {
    const states = onlyOpen
        ? ['open', 'draft']
        : [view.merged ? 'merged' : null, view.closed ? 'closed' : null].filter(Boolean)
    return {
        state: states.length > 0 ? states.join(',') : undefined,
        repo: view.repo || undefined,
        tag: view.tag || undefined,
        search: search.trim() || undefined,
        sortBy: view.sort === 'updated' ? 'updatedAt' : 'prOpenedAt',
        sortOrder: view.sort === 'oldest' ? 'asc' : 'desc',
    }
}
