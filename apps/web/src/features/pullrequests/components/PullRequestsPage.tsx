import React from 'react'

import { useAppStore } from '@/app/store'
import { ChoiceGroup } from '@/features/connections/components/ConnectionsUi'
import { MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import { requestWorkspaceTab } from '@/features/preview/lib/workspaceTabRequest'
import { useGithubConnection } from '@/features/profile/hooks/useGithubConnection'
import {
    PULL_REQUEST_FILTERS,
    PULL_REQUEST_STATE_LABELS,
    filterPullRequests,
    searchPullRequests,
    toPullRequestRows,
    type PullRequestFilter,
    type PullRequestState,
} from '@/features/pullrequests/lib/pullRequests'
import {
    ListEmptyState,
    ListErrorState,
    ListRowsSkeleton,
    ListSearchInput,
    ListToolbar,
    MetaDot,
    RelativeTime,
    listRowClass,
} from '@/features/sessions/components/ListParts'
import { useSessions } from '@/features/sessions/hooks/useSessions'
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

interface PullRequestsPageProps {
    onOpenProject: (sessionId: string) => void
}

/** pull requests that December opened, across all sessions */
export const PullRequestsPage: React.FC<PullRequestsPageProps> = ({ onOpenProject }) => {
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const { data, isLoading, error, refetch } = useSessions(PULL_REQUEST_QUERY)
    const github = useGithubConnection(isAuthenticated)
    const [filter, setFilter] = React.useState<PullRequestFilter>('all')
    const [query, setQuery] = React.useState('')

    const allRows = React.useMemo(() => toPullRequestRows(data?.sessions || []), [data?.sessions])
    const rows = React.useMemo(
        () => searchPullRequests(filterPullRequests(allRows, filter), query),
        [allRows, filter, query]
    )

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
                <h1 className="text-[24px] font-sans font-medium tracking-[-0.025em] text-[#D6D5C9] mb-6">
                    Pull requests
                </h1>

                <ListToolbar
                    search={
                        <ListSearchInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Search pull requests..."
                        />
                    }
                >
                    <ChoiceGroup
                        label="Pull request state"
                        options={PULL_REQUEST_FILTERS}
                        value={filter}
                        onChange={setFilter}
                    />
                </ListToolbar>

                {isLoading ? (
                    <ListRowsSkeleton rows={4} />
                ) : error && allRows.length === 0 ? (
                    <ListErrorState
                        message="Could not load pull requests."
                        onRetry={() => void refetch()}
                    />
                ) : needsGithub ? (
                    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3.5 px-6 py-12 text-center text-[13px] text-[#7B7A79]">
                        <span>Connect GitHub to see pull requests.</span>
                        <a
                            href={github.connectUrl}
                            className="bg-white text-black hover:bg-neutral-200 transition-colors text-[13px] font-medium px-4 py-2 rounded-lg"
                        >
                            Connect GitHub
                        </a>
                    </div>
                ) : rows.length === 0 ? (
                    <ListEmptyState
                        title={
                            allRows.length === 0 ? 'No pull requests yet' : 'No pull requests found'
                        }
                    />
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
                                            <RelativeTime iso={row.updatedAt} label="Updated" />
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
