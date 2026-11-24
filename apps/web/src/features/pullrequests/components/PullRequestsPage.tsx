import React from 'react'

import { useAppStore } from '@/app/store'
import { MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import { requestWorkspaceTab } from '@/features/preview/lib/workspaceTabRequest'
import { useGithubConnection } from '@/features/profile/hooks/useGithubConnection'
import {
    PULL_REQUEST_STATE_LABELS,
    isOpenPullRequest,
    searchPullRequests,
    toPullRequestRows,
    type PullRequestState,
} from '@/features/pullrequests/lib/pullRequests'
import {
    activePullRequestFilters,
    applyPullRequestsView,
    pullRequestFacets,
    readPullRequestsView,
    writePullRequestsView,
    type PullRequestsView,
} from '@/features/pullrequests/lib/pullRequestsView'
import {
    ListEmptyState,
    ListErrorState,
    ListRowsSkeleton,
    ListSearchInput,
    ListSwitch,
    ListToolbar,
    MetaDot,
    RelativeTime,
    listActionButtonClass,
    listRowClass,
} from '@/features/sessions/components/ListParts'
import { ViewMenu } from '@/features/sessions/components/ViewMenu'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import { SESSIONS_SORT_OPTIONS, shortRepoName } from '@/features/sessions/lib/sessionsView'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

// the server returns only sessions that opened a pull request (hasPr). 100 is the most
// one request returns
const PULL_REQUEST_QUERY = {
    limit: 100,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    hasPr: true,
} as const

const STATE_TAG_CLASS: Record<PullRequestState, string> = {
    open: 'bg-emerald-500/10 text-emerald-400',
    draft: 'bg-[#262626] text-[#8F8E8D]',
    merged: 'bg-[#C084FC]/[0.12] text-[#C084FC]',
    closed: 'bg-red-500/10 text-red-400',
}

/** a saved value stays in its list even when no loaded row has it */
const withPicked = (values: string[], picked: string | null) =>
    picked && !values.includes(picked) ? [...values, picked].sort() : values

interface PullRequestsPageProps {
    onOpenProject: (sessionId: string) => void
}

/** pull requests that December opened, across all sessions */
export const PullRequestsPage: React.FC<PullRequestsPageProps> = ({ onOpenProject }) => {
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const { data, isLoading, error, refetch } = useSessions(PULL_REQUEST_QUERY)
    const github = useGithubConnection(isAuthenticated)
    // the All | Open switch next to search
    const [onlyOpen, setOnlyOpen] = React.useState(false)
    // the sort and filter menu. saved in the browser, like the Sessions page
    const [view, setView] = React.useState<PullRequestsView>(readPullRequestsView)
    const [query, setQuery] = React.useState('')

    const changeView = (next: Partial<PullRequestsView>) => {
        const merged = { ...view, ...next }
        setView(merged)
        writePullRequestsView(merged)
        // Merged or Closed with the switch on Open would always be empty
        if (merged.merged || merged.closed) setOnlyOpen(false)
    }
    const pickOnlyOpen = (isOn: boolean) => {
        setOnlyOpen(isOn)
        if (isOn && (view.merged || view.closed)) {
            const withoutStates = { ...view, merged: false, closed: false }
            setView(withoutStates)
            writePullRequestsView(withoutStates)
        }
    }

    const allRows = React.useMemo(() => toPullRequestRows(data?.sessions || []), [data?.sessions])
    const rows = React.useMemo(
        () => searchPullRequests(applyPullRequestsView(allRows, view, onlyOpen), query),
        [allRows, view, onlyOpen, query]
    )
    const openCount = React.useMemo(() => allRows.filter(isOpenPullRequest).length, [allRows])
    const facets = React.useMemo(() => pullRequestFacets(allRows), [allRows])
    const activeFilters = activePullRequestFilters(view)
    const filtersOn = onlyOpen || activeFilters.length > 0
    const clearFilters = () => {
        changeView({ merged: false, closed: false, repo: null, tag: null })
        setOnlyOpen(false)
    }
    // with Newest or Oldest the row shows the created time, like the Sessions rows
    const showCreated = view.sort !== 'updated'

    const openSession = (sessionId: string) => {
        // the session opens on its pull request view
        requestWorkspaceTab('pull_requests')
        onOpenProject(sessionId)
    }

    const needsGithub = github.isReady && !github.isConnected && allRows.length === 0

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background font-sans no-scrollbar">
            {/* the page heading below says Pull requests, so the bar only holds the menu */}
            <MobileTopBar />

            <div className="relative z-10 mx-auto max-w-6xl px-3.5 sm:px-6 pb-8 pt-4 md:p-16 flex flex-col">
                <div className="mb-6 flex flex-col">
                    <h1 className="text-[24px] font-sans font-medium tracking-[-0.025em] text-[#D6D5C9] mb-1">
                        Pull requests
                    </h1>
                    <p className="text-[13px] text-[#7B7A79]">
                        View all pull requests opened from your sessions.
                    </p>
                </div>

                <ListToolbar
                    search={
                        <ListSearchInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Search pull requests..."
                        />
                    }
                >
                    <ListSwitch
                        onLabel="Open"
                        isOn={onlyOpen}
                        onChange={pickOnlyOpen}
                        count={openCount}
                    />

                    <div className="flex-1" />

                    <ViewMenu
                        sorts={SESSIONS_SORT_OPTIONS}
                        sort={view.sort}
                        onSort={(sort) => changeView({ sort })}
                        activeFilters={activeFilters}
                        toggles={[
                            {
                                key: 'merged',
                                label: 'Merged',
                                checked: view.merged,
                                onToggle: () => changeView({ merged: !view.merged }),
                            },
                            {
                                key: 'closed',
                                label: 'Closed',
                                checked: view.closed,
                                onToggle: () => changeView({ closed: !view.closed }),
                            },
                        ]}
                        lists={[
                            {
                                key: 'repo',
                                label: 'Repository',
                                value: view.repo,
                                options: withPicked(facets.repos, view.repo).map((repo) => ({
                                    value: repo,
                                    label: shortRepoName(repo),
                                })),
                                onPick: (repo) => changeView({ repo }),
                            },
                            {
                                key: 'tag',
                                label: 'Tag',
                                value: view.tag,
                                options: withPicked(facets.tags, view.tag).map((tag) => ({
                                    value: tag,
                                    label: tag,
                                })),
                                onPick: (tag) => changeView({ tag }),
                            },
                        ]}
                    />
                </ListToolbar>

                {isLoading ? (
                    <ListRowsSkeleton rows={4} />
                ) : error && allRows.length === 0 ? (
                    <ListErrorState
                        message="Could not load pull requests"
                        onRetry={() => void refetch()}
                    />
                ) : needsGithub ? (
                    <ListEmptyState art="connect" title="Connect GitHub to see pull requests">
                        <a href={github.connectUrl} className={listActionButtonClass}>
                            Connect GitHub
                        </a>
                    </ListEmptyState>
                ) : rows.length === 0 ? (
                    <ListEmptyState
                        art={allRows.length === 0 ? 'pullRequests' : 'noResults'}
                        title={
                            allRows.length === 0 ? 'No pull requests yet' : 'No pull requests found'
                        }
                    >
                        {allRows.length > 0 && filtersOn && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className={listActionButtonClass}
                            >
                                Clear filters
                            </button>
                        )}
                    </ListEmptyState>
                ) : (
                    <div className="flex flex-col gap-1 pb-4">
                        {rows.map((row) => (
                            <div
                                key={row.sessionId}
                                role="button"
                                tabIndex={0}
                                onClick={() => openSession(row.sessionId)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        openSession(row.sessionId)
                                    }
                                }}
                                className={cn(
                                    'group flex items-center gap-3 min-w-0',
                                    listRowClass
                                )}
                            >
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <span className="truncate text-[14px] font-medium text-[#D6D5C9]">
                                        {row.title}
                                    </span>
                                    <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-[#7B7A79]">
                                        <span className="truncate shrink-[2]">
                                            {row.repo ? `${row.repo.split('/').pop()} ` : ''}#
                                            {row.number}
                                        </span>
                                        {row.branch && (
                                            <>
                                                <MetaDot />
                                                <span className="truncate font-mono text-[11.5px]">
                                                    {row.branch}
                                                </span>
                                            </>
                                        )}
                                        <MetaDot />
                                        <span className="shrink-0">
                                            {showCreated ? (
                                                <>
                                                    Created{' '}
                                                    <RelativeTime
                                                        iso={row.createdAt}
                                                        label="Created"
                                                    />
                                                </>
                                            ) : (
                                                <RelativeTime iso={row.updatedAt} label="Updated" />
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <span
                                    className={cn(
                                        'inline-flex items-center rounded-full px-2 py-px text-[11px] font-medium whitespace-nowrap shrink-0',
                                        STATE_TAG_CLASS[row.state]
                                    )}
                                >
                                    {PULL_REQUEST_STATE_LABELS[row.state]}
                                </span>
                                {row.url && (
                                    <a
                                        href={row.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Open pull request ${row.number} on GitHub`}
                                        onClick={(event) => event.stopPropagation()}
                                        onKeyDown={(event) => event.stopPropagation()}
                                        className="p-1 rounded-md text-[#7B7A79] hover:text-white hover:bg-[#2E2E2E] transition-all shrink-0 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100 md:focus-visible:opacity-100"
                                    >
                                        <Icons.Github className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
