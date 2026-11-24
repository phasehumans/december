import type { BackendSession, SessionFilters } from '@/features/sessions/api/session'

import { repoNameOf } from '@/features/pullrequests/lib/pullRequests'

// the Sessions page view: one sort and the filters of the "sort and filter" menu.
// the All | Running switch in the toolbar is not part of it.

export type SessionsSort = 'updated' | 'newest' | 'oldest'

export interface SessionsView {
    sort: SessionsSort
    /** only sessions that opened a pull request */
    hasPr: boolean
    /** only sessions where the agent waits for an answer */
    needsAnswer: boolean
    /** only archived sessions. when off, archived sessions stay out of the list */
    archived: boolean
    /** owner/name of one repository, or null for any */
    repo: string | null
    tag: string | null
}

export const DEFAULT_SESSIONS_VIEW: SessionsView = {
    sort: 'updated',
    hasPr: false,
    needsAnswer: false,
    archived: false,
    repo: null,
    tag: null,
}

export const SESSIONS_SORTS: SessionsSort[] = ['updated', 'newest', 'oldest']

/** Newest and Oldest go by created date */
export const SESSIONS_SORT_LABELS: Record<SessionsSort, string> = {
    updated: 'Last updated',
    newest: 'Newest',
    oldest: 'Oldest',
}

/** the sort rows of the menu. the Pull requests page uses the same three */
export const SESSIONS_SORT_OPTIONS: { value: SessionsSort; label: string }[] = SESSIONS_SORTS.map(
    (sort) => ({ value: sort, label: SESSIONS_SORT_LABELS[sort] })
)

const VIEW_KEY = 'december:sessions-view'

const textOrNull = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value : null

/** the saved view, or the default when nothing is saved or storage is blocked */
export const readSessionsView = (): SessionsView => {
    try {
        const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null')
        if (!saved || typeof saved !== 'object') return DEFAULT_SESSIONS_VIEW
        return {
            sort: SESSIONS_SORTS.includes(saved.sort) ? saved.sort : 'updated',
            hasPr: saved.hasPr === true,
            needsAnswer: saved.needsAnswer === true,
            archived: saved.archived === true,
            repo: textOrNull(saved.repo),
            tag: textOrNull(saved.tag),
        }
    } catch (err) {
        // Intentionally swallowed: storage blocked or bad json, the default view is fine
        return DEFAULT_SESSIONS_VIEW
    }
}

export const writeSessionsView = (view: SessionsView): void => {
    try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(view))
    } catch (err) {
        // Intentionally swallowed: storage blocked, the view lasts until reload
    }
}

/** the last part of owner/name, which is what the rows show */
export const shortRepoName = (repo: string): string => repo.split('/').pop() || repo

/** names of the filters that are on, in menu order */
export const activeViewFilters = (view: SessionsView): string[] => {
    const names: string[] = []
    if (view.hasPr) names.push('Pull request')
    if (view.needsAnswer) names.push('Needs answer')
    if (view.archived) names.push('Archived')
    if (view.repo) names.push(shortRepoName(view.repo))
    if (view.tag) names.push(view.tag)
    return names
}

/** how the sort and filter button names the filters that are on: one name, or a count */
export const filtersLabel = (names: string[]): string | null =>
    names.length === 0 ? null : names.length === 1 ? names[0] : `${names.length} filters`

/** the button text: what is on, then the sort. "Archived · Last updated" */
export const sessionsViewLabel = (
    view: SessionsView
): { filters: string | null; sort: string } => ({
    filters: filtersLabel(activeViewFilters(view)),
    sort: SESSIONS_SORT_LABELS[view.sort],
})

/**
 * the list API is not ready for the Repository and Tag filters: it does not accept
 * repoName, and tags is missing from its cache key, so a tag request can return or leave
 * behind the wrong cached list. until the server part ships, these two are not sent and
 * the page filters the rows that are loaded (the rows only show with the preview flag).
 * web follow-up: set this to true and remove the preview gate in SessionList.tsx.
 */
export const SERVER_FILTERS_REPO_AND_TAG = false

/** the view as list API filters */
export const sessionsViewFilters = (
    view: SessionsView,
    sendRepoAndTag: boolean = SERVER_FILTERS_REPO_AND_TAG
): Pick<
    SessionFilters,
    'sortBy' | 'sortOrder' | 'hasPr' | 'needsAnswer' | 'isArchived' | 'tags' | 'repoName'
> => ({
    sortBy: view.sort === 'updated' ? 'updatedAt' : 'createdAt',
    sortOrder: view.sort === 'oldest' ? 'asc' : 'desc',
    hasPr: view.hasPr || undefined,
    needsAnswer: view.needsAnswer || undefined,
    isArchived: view.archived,
    tags: sendRepoAndTag && view.tag ? [view.tag] : undefined,
    repoName: sendRepoAndTag && view.repo ? shortRepoName(view.repo) : undefined,
})

const sortTime = (session: BackendSession, sort: SessionsSort): number =>
    new Date(
        sort === 'updated' ? session.updatedAt || session.createdAt : session.createdAt
    ).getTime() || 0

/**
 * the same view on rows that are already loaded. the server filters and sorts too; this
 * keeps the list right between an action (archive, tag) and the next fetch.
 */
export const applySessionsView = (sessions: BackendSession[], view: SessionsView) =>
    sessions
        .filter((session) => {
            if (Boolean(session.isArchived) !== view.archived) return false
            if (view.hasPr && !session.prNumber) return false
            if (view.needsAnswer && !session.needsAnswer) return false
            if (view.repo && repoNameOf(session) !== view.repo) return false
            if (view.tag && !(session.tags || []).includes(view.tag)) return false
            return true
        })
        .sort((a, b) =>
            view.sort === 'oldest'
                ? sortTime(a, view.sort) - sortTime(b, view.sort)
                : sortTime(b, view.sort) - sortTime(a, view.sort)
        )

/** repositories and tags seen on loaded sessions, for the menu lists */
export const collectSessionFacets = (
    sessions: BackendSession[],
    previous: { repos: string[]; tags: string[] }
): { repos: string[]; tags: string[] } => {
    const repos = new Set(previous.repos)
    const tags = new Set(previous.tags)
    for (const session of sessions) {
        const repo = repoNameOf(session)
        if (repo) repos.add(repo)
        for (const tag of session.tags || []) tags.add(tag)
    }
    if (repos.size === previous.repos.length && tags.size === previous.tags.length) return previous
    return { repos: [...repos].sort(), tags: [...tags].sort() }
}
