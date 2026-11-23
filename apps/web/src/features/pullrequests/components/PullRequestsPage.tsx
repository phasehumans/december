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
    toPullRequestRows,
    type PullRequestFilter,
    type PullRequestState,
} from '@/features/pullrequests/lib/pullRequests'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import { Icons } from '@/shared/components/ui/Icons'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { cn } from '@/shared/lib/utils'

// the sessions list is the only source today. 100 is the most one request returns
const SESSIONS_LIMIT = 100

const STATE_TAG_CLASS: Record<PullRequestState, string> = {
    open: 'bg-emerald-500/10 text-emerald-400',
    draft: 'bg-[#262626] text-[#8F8E8D]',
    merged: 'bg-[#C084FC]/[0.12] text-[#C084FC]',
    closed: 'bg-red-500/10 text-red-400',
}

const listBoxClass =
    'bg-[#191919] border border-[#242323] rounded-xl overflow-hidden flex flex-col divide-y divide-[#242323]'

interface PullRequestsPageProps {
    onOpenProject: (sessionId: string) => void
}

/** pull requests that December opened, across all sessions */
export const PullRequestsPage: React.FC<PullRequestsPageProps> = ({ onOpenProject }) => {
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const { data, isLoading } = useSessions({
        limit: SESSIONS_LIMIT,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
    })
    const github = useGithubConnection(isAuthenticated)
    const [filter, setFilter] = React.useState<PullRequestFilter>('all')

    const allRows = React.useMemo(() => toPullRequestRows(data?.sessions || []), [data?.sessions])
    const rows = React.useMemo(() => filterPullRequests(allRows, filter), [allRows, filter])

    const openSession = (sessionId: string) => {
        // the session opens on its pull request view
        requestWorkspaceTab('pull_requests')
        onOpenProject(sessionId)
    }

    const needsGithub = github.isReady && !github.isConnected && allRows.length === 0

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background font-sans no-scrollbar">
            <MobileTopBar title="Pull requests" />

            <div className="relative z-10 mx-auto max-w-[900px] px-3.5 sm:px-6 pb-8 pt-2 md:p-16 flex flex-col">
                <h1 className="hidden md:block text-[24px] font-sans font-medium tracking-[-0.025em] text-[#D6D5C9] mb-5">
                    Pull requests
                </h1>
                <div className="mb-4">
                    <ChoiceGroup
                        label="Pull request state"
                        options={PULL_REQUEST_FILTERS}
                        value={filter}
                        onChange={setFilter}
                    />
                </div>

                {isLoading ? (
                    <div className={listBoxClass} aria-busy="true">
                        {[52, 40, 46].map((width) => (
                            <div key={width} className="flex flex-col gap-2 px-4 py-3.5">
                                <Skeleton
                                    className="h-3 bg-white/[0.04] rounded"
                                    style={{ width: `${width}%` }}
                                />
                                <Skeleton className="h-2.5 w-32 bg-white/[0.02] rounded" />
                            </div>
                        ))}
                    </div>
                ) : needsGithub ? (
                    <div
                        className={cn(
                            listBoxClass,
                            'items-center gap-3.5 px-4 py-9 text-[13px] text-[#7B7A79]'
                        )}
                    >
                        <span>Connect GitHub to see pull requests.</span>
                        <a
                            href={github.connectUrl}
                            className="bg-white text-black hover:bg-neutral-200 transition-colors text-[13px] font-medium px-4 py-2 rounded-lg"
                        >
                            Connect GitHub
                        </a>
                    </div>
                ) : rows.length === 0 ? (
                    <div
                        className={cn(
                            listBoxClass,
                            'items-center px-4 py-9 text-[13px] text-[#7B7A79]'
                        )}
                    >
                        {allRows.length === 0 ? 'No pull requests yet.' : 'No pull requests here.'}
                    </div>
                ) : (
                    <div className={listBoxClass}>
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
                                className="flex items-center gap-3.5 px-4 py-2.5 min-w-0 cursor-pointer hover:bg-[#1D1D1D] transition-colors outline-none focus-visible:bg-[#1D1D1D]"
                            >
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <span className="truncate text-[14px] font-medium text-[#D6D5C9]">
                                        {row.title}
                                    </span>
                                    <span className="truncate text-[12px] text-[#7B7A79]">
                                        {row.repo ? `${row.repo} ` : ''}#{row.number} ·{' '}
                                        {formatRelativeTime(row.updatedAt)}
                                    </span>
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
                                        className="p-1 rounded-md text-[#7B7A79] hover:text-white hover:bg-[#2E2E2E] transition-colors shrink-0"
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
