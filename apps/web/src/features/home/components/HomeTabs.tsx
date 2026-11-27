import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import type { BackendSession } from '@/features/sessions/api/session'

import { useAppStore } from '@/app/store'
import { SoonTag } from '@/features/home/components/PromptMenus'
import { requestWorkspaceTab } from '@/features/preview/lib/workspaceTabRequest'
import {
    PULL_REQUEST_STATE_CLASS,
    PULL_REQUEST_STATE_LABELS,
    toPullRequestRows,
} from '@/features/pullrequests/lib/pullRequests'
import { sessionAPI } from '@/features/sessions/api/session'
import { RunStatus } from '@/features/sessions/components/ListParts'
import { useSessionCounts, useSessions } from '@/features/sessions/hooks/useSessions'
import { OfficeCanvas } from '@/features/supercrew/components/OfficeCanvas'
import { useSuperCrewWaitlist } from '@/features/supercrew/hooks/useSuperCrewWaitlist'
import { SUPER_CREW_LINE } from '@/features/supercrew/lib/copy'
import { Icons } from '@/shared/components/ui/Icons'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

// the tabs under the Home prompt box: Recent, Pull requests, Super Crew.
// Recent: sessions that need an answer, then running and starting ones, then pinned ones,
// then the newest, 5 rows. Pull requests: open and draft ones only, 5 rows. "View all"
// opens the full page (right of the tabs, or a row under the list on phones).

type HomeTab = 'recent' | 'pull-requests' | 'super-crew'

const TABS: { id: HomeTab; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'pull-requests', label: 'Pull requests' },
    { id: 'super-crew', label: 'Super Crew' },
]
const ROW_LIMIT = 5
const STORAGE_KEY = 'december:home-tab'

// the same filters as the default sidebar Recent list and its running list, so on desktop
// the two share one request each
const RECENT_FILTERS = {
    type: 'WEB',
    isArchived: false,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    pinnedFirst: true,
    limit: 20,
} as const
const RUNNING_FILTERS = { type: 'WEB', isArchived: false, vmStatus: 'running', limit: 50 } as const
const NEEDS_ANSWER_FILTERS = {
    type: 'WEB',
    isArchived: false,
    needsAnswer: true,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: ROW_LIMIT,
} as const
const OPEN_PULL_REQUESTS = {
    state: 'open,draft',
    sortBy: 'prUpdatedAt',
    sortOrder: 'desc',
    limit: ROW_LIMIT,
} as const

const readSavedTab = (): HomeTab => {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        return TABS.some((tab) => tab.id === saved) ? (saved as HomeTab) : 'recent'
    } catch {
        // Intentionally swallowed: storage can be blocked, the first tab is used
        return 'recent'
    }
}

const isWorking = (session: BackendSession) =>
    session.vmStatus === 'RUNNING' || session.vmStatus === 'PROVISIONING'

/** 0 needs an answer, 1 runs or starts, 2 pinned, 3 the rest */
const rankOf = (session: BackendSession) =>
    session.needsAnswer ? 0 : isWorking(session) ? 1 : session.isPinned || session.pinnedAt ? 2 : 3

/**
 * the Recent rows: the lists in the order given, each session once, archived and search
 * sessions left out, then a stable sort by rank so each group keeps its list order
 */
export const homeRecentRows = (lists: (BackendSession[] | undefined)[]): BackendSession[] => {
    const seen = new Set<string>()
    const rows: BackendSession[] = []
    for (const list of lists) {
        for (const session of list || []) {
            if (seen.has(session.id) || session.isArchived || session.type === 'SEARCH') continue
            seen.add(session.id)
            rows.push(session)
        }
    }
    return rows
        .map((session, index) => ({ session, index }))
        .sort((a, b) => rankOf(a.session) - rankOf(b.session) || a.index - b.index)
        .map(({ session }) => session)
        .slice(0, ROW_LIMIT)
}

const rowClass =
    'flex items-center justify-between gap-3 w-full min-w-0 px-1.5 py-1.5 rounded-lg text-left hover:bg-[#1C1C1C] transition-colors outline-none cursor-pointer focus-visible:bg-[#1C1C1C]'
const titleClass = 'truncate text-[12.5px] text-[#EDEDED] tracking-tight'
const metaClass = 'shrink-0 whitespace-nowrap text-[11.5px] text-[#8F8E8D]'
const emptyClass = 'px-1.5 py-3 text-[12.5px] text-[#616161]'

const LoadingRows: React.FC = () => (
    <div aria-busy="true">
        {[46, 62, 38, 54, 44].map((width) => (
            <div key={width} className="flex items-center justify-between gap-3 px-1.5 py-[9px]">
                <Skeleton
                    className="h-2.5 bg-white/[0.05] rounded"
                    style={{ width: `${width}%` }}
                />
                <Skeleton className="h-2.5 w-12 bg-white/[0.03] rounded" />
            </div>
        ))}
    </div>
)

const LoadError: React.FC<{ what: string; onRetry: () => void }> = ({ what, onRetry }) => (
    <div className="flex items-center gap-2.5 px-1.5 py-3 text-[12.5px] text-[#8F8E8D]">
        <span>Could not load {what}.</span>
        <button
            type="button"
            onClick={onRetry}
            className="rounded-[7px] border border-[#383735] px-2 py-0.5 text-[12px] text-[#D6D5C9] hover:bg-[#1C1C1C] transition-colors outline-none cursor-pointer focus-visible:bg-[#1C1C1C]"
        >
            Try again
        </button>
    </div>
)

interface HomeTabsProps {
    onOpenProject?: (sessionId: string) => void
}

export const HomeTabs: React.FC<HomeTabsProps> = ({ onOpenProject }) => {
    const navigate = useNavigate()
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)
    const [tab, setTab] = React.useState<HomeTab>(readSavedTab)
    const { state: waitlist, isLoading: isWaitlistLoading, join } = useSuperCrewWaitlist(true)
    const isPhone = useIsPhone()

    const selectTab = (next: HomeTab) => {
        setTab(next)
        try {
            window.localStorage.setItem(STORAGE_KEY, next)
        } catch {
            // Intentionally swallowed: storage can be blocked, the tab is then not remembered
        }
    }

    // Recent: three short lists, merged. each reads again every 5 s while a row works
    const recentQuery = useSessions(RECENT_FILTERS, { refreshWhileWorking: true })
    const runningQuery = useSessions(RUNNING_FILTERS, { refreshWhileWorking: true })
    const needsAnswerQuery = useSessions(NEEDS_ANSWER_FILTERS, { refreshWhileWorking: true })
    const recent = React.useMemo(
        () =>
            homeRecentRows([
                needsAnswerQuery.data?.sessions,
                runningQuery.data?.sessions,
                recentQuery.data?.sessions,
            ]),
        [needsAnswerQuery.data?.sessions, runningQuery.data?.sessions, recentQuery.data?.sessions]
    )
    const retryRecent = () => {
        void recentQuery.refetch()
        void runningQuery.refetch()
        void needsAnswerQuery.refetch()
    }

    // Pull requests: open and draft only, read when the tab is open. under ['sessions'],
    // so every list write reads them again
    const isPullRequestsTab = tab === 'pull-requests'
    const openPullRequestsQuery = useQuery({
        queryKey: ['sessions', 'pull-requests', 'home', OPEN_PULL_REQUESTS],
        queryFn: () => sessionAPI.getPullRequests(OPEN_PULL_REQUESTS),
        enabled: isAuthenticated && isPullRequestsTab,
    })
    const pullRequests = React.useMemo(
        () => toPullRequestRows(openPullRequestsQuery.data?.pullRequests || []),
        [openPullRequestsQuery.data?.pullRequests]
    )
    // nothing open: one row of any state tells "No open pull requests" from "none yet"
    const hasNoOpen = Boolean(openPullRequestsQuery.data) && pullRequests.length === 0
    const anyPullRequestQuery = useQuery({
        queryKey: ['sessions', 'pull-requests', 'home', { limit: 1 }],
        queryFn: () => sessionAPI.getPullRequests({ limit: 1 }),
        enabled: isAuthenticated && isPullRequestsTab && hasNoOpen,
    })
    const hasAnyPullRequest = (anyPullRequestQuery.data?.pagination.total ?? 0) > 0
    const retryPullRequests = () => {
        void openPullRequestsQuery.refetch()
        if (hasNoOpen) void anyPullRequestQuery.refetch()
    }

    // grey counts beside the tab names: over every session, not only the rows shown
    const { data: counts } = useSessionCounts()
    const countOf: Partial<Record<HomeTab, number>> = {
        recent: counts?.needsYou ?? 0,
        'pull-requests': counts?.openPullRequests ?? 0,
    }

    const preview = isSkeletonPreviewActive()
    const isRecentLoading =
        preview ||
        (recent.length === 0 &&
            (recentQuery.isLoading || runningQuery.isLoading || needsAnswerQuery.isLoading))
    const isRecentError = !isRecentLoading && recentQuery.isError && recent.length === 0
    const isPullRequestsLoading =
        preview || openPullRequestsQuery.isLoading || (hasNoOpen && anyPullRequestQuery.isLoading)
    const isPullRequestsError =
        !isPullRequestsLoading &&
        (openPullRequestsQuery.isError || (hasNoOpen && anyPullRequestQuery.isError))

    const viewAllPath =
        tab === 'recent' && !isRecentLoading && recent.length > 0
            ? '/sessions'
            : isPullRequestsTab &&
                !isPullRequestsLoading &&
                !isPullRequestsError &&
                (pullRequests.length > 0 || hasAnyPullRequest)
              ? '/pull-requests'
              : null

    return (
        <div data-testid="home-tabs" className="mt-[18px] px-1.5 font-sans">
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <div
                    role="tablist"
                    className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar [scrollbar-width:none]"
                >
                    {TABS.map((item) => {
                        const count = countOf[item.id] ?? 0
                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === item.id}
                                onClick={() => selectTab(item.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-lg transition-colors outline-none cursor-pointer whitespace-nowrap',
                                    tab === item.id
                                        ? 'bg-[#262626] text-white'
                                        : 'text-[#8F8E8D] hover:text-[#D6D5C9]'
                                )}
                            >
                                <span>{item.label}</span>
                                {count > 0 && (
                                    <span
                                        data-testid={`home-tab-count-${item.id}`}
                                        className="font-normal tabular-nums text-[#8F8E8D]"
                                    >
                                        {count}
                                    </span>
                                )}
                                {item.id === 'super-crew' && <SoonTag />}
                            </button>
                        )
                    })}
                </div>
                {viewAllPath && (
                    <button
                        type="button"
                        onClick={() => navigate(viewAllPath)}
                        className="hidden sm:block shrink-0 pr-1.5 text-[12px] font-medium text-[#8F8E8D] hover:text-[#D6D5C9] transition-colors outline-none cursor-pointer"
                    >
                        View all
                    </button>
                )}
            </div>

            <div role="tabpanel">
                {tab === 'recent' &&
                    (isRecentLoading ? (
                        <LoadingRows />
                    ) : isRecentError ? (
                        <LoadError what="sessions" onRetry={retryRecent} />
                    ) : recent.length === 0 ? (
                        <div className={emptyClass}>No sessions yet.</div>
                    ) : (
                        recent.map((session) => (
                            <button
                                key={session.id}
                                type="button"
                                onClick={() => onOpenProject?.(session.id)}
                                className={rowClass}
                            >
                                <span className={titleClass}>
                                    {session.title || session.projectName || 'Untitled session'}
                                </span>
                                {session.needsAnswer ? (
                                    // same word and colour as the sidebar and the Sessions page
                                    <span className={cn(metaClass, 'text-amber-400')}>
                                        Needs answer
                                    </span>
                                ) : isWorking(session) ? (
                                    <RunStatus vmStatus={session.vmStatus} className={metaClass} />
                                ) : (
                                    <span
                                        className={cn(
                                            metaClass,
                                            'inline-flex items-center gap-1.5'
                                        )}
                                    >
                                        {(session.isPinned || session.pinnedAt) && (
                                            <Icons.Pin
                                                aria-label="Pinned"
                                                className="h-3 w-3 text-[#7B7A79]"
                                            />
                                        )}
                                        {session.prNumber ? `PR ${session.prNumber} · ` : ''}
                                        {formatRelativeTime(session.updatedAt)}
                                    </span>
                                )}
                            </button>
                        ))
                    ))}

                {isPullRequestsTab &&
                    (isPullRequestsLoading ? (
                        <LoadingRows />
                    ) : isPullRequestsError ? (
                        <LoadError what="pull requests" onRetry={retryPullRequests} />
                    ) : pullRequests.length === 0 ? (
                        <div className={emptyClass}>
                            {hasAnyPullRequest ? 'No open pull requests.' : 'No pull requests yet.'}
                        </div>
                    ) : (
                        pullRequests.map((row) => (
                            <button
                                key={row.sessionId}
                                type="button"
                                onClick={() => {
                                    // the session opens on its pull request view
                                    requestWorkspaceTab('pull_requests')
                                    onOpenProject?.(row.sessionId)
                                }}
                                className={rowClass}
                            >
                                <span className={titleClass}>{row.title}</span>
                                <span className={metaClass}>
                                    {row.repo ? `${row.repo} ` : ''}#{row.number} ·{' '}
                                    <span className={PULL_REQUEST_STATE_CLASS[row.state]}>
                                        {PULL_REQUEST_STATE_LABELS[row.state]}
                                    </span>
                                </span>
                            </button>
                        ))
                    ))}

                {viewAllPath && (
                    // phones: View all is a row under the list, the tabs row has no room
                    <button
                        type="button"
                        onClick={() => navigate(viewAllPath)}
                        className="sm:hidden w-full px-1.5 py-1.5 text-left text-[12px] font-medium text-[#8F8E8D] hover:text-[#D6D5C9] transition-colors outline-none cursor-pointer"
                    >
                        View all
                    </button>
                )}

                {tab === 'super-crew' && (
                    // the horizontal strip: office on the left, name, one line and the button.
                    // phones: no office, a smaller card with the button beside the name.
                    <div className="mt-0.5 flex items-stretch overflow-hidden rounded-2xl border border-[#2A2928] bg-[#1E1E1E]">
                        {!isPhone && (
                            <OfficeCanvas
                                compact
                                className="m-1.5 w-[166px] min-h-[92px] shrink-0 overflow-hidden rounded-[10px] border border-[#2A2928] bg-[#121212]"
                            />
                        )}
                        <div
                            className={cn(
                                'min-w-0 flex-1',
                                isPhone
                                    ? 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5'
                                    : 'flex flex-col items-start gap-[7px] py-2.5 pl-1 pr-3'
                            )}
                        >
                            <div className="flex items-center gap-[7px] min-w-0">
                                <Icons.CrewDots className="w-3.5 h-3.5 text-[#D6D5D4] shrink-0" />
                                <span className="text-[12.5px] font-semibold text-[#EDEDED] truncate">
                                    Super Crew
                                </span>
                                <SoonTag />
                            </div>
                            <p
                                className={cn(
                                    'text-[12px] leading-[1.45] text-[#919191]',
                                    isPhone && 'col-span-2 row-start-2'
                                )}
                            >
                                {SUPER_CREW_LINE}
                            </p>
                            {isWaitlistLoading ? (
                                // holds the button's place, so a user on the list never sees "Notify me"
                                <div
                                    className={cn(
                                        'h-[28px]',
                                        isPhone ? 'col-start-2 row-start-1 w-[84px]' : 'mt-auto'
                                    )}
                                    aria-hidden="true"
                                />
                            ) : waitlist?.joined ? (
                                <div
                                    className={cn(
                                        'flex h-[28px] items-center gap-1.5 rounded-[8px] bg-[#252525] px-3 text-[12.5px] font-medium text-[#D6D5D4] select-none whitespace-nowrap',
                                        // phones: own line under the subheading, not beside the name
                                        isPhone
                                            ? 'col-span-2 row-start-3 mt-1 justify-self-start'
                                            : 'mt-auto'
                                    )}
                                >
                                    <Check
                                        className="w-3.5 h-3.5 text-[#87B2F4]"
                                        strokeWidth={2.5}
                                    />
                                    You&apos;re on the list
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => join.mutate()}
                                    disabled={join.isPending}
                                    className={cn(
                                        'h-[28px] px-3 rounded-[8px] bg-[#E8E8E8] hover:bg-white text-[#141414] text-[12.5px] font-medium transition-colors cursor-pointer outline-none disabled:opacity-70 disabled:cursor-default whitespace-nowrap',
                                        isPhone ? 'col-start-2 row-start-1' : 'mt-auto'
                                    )}
                                >
                                    Notify me
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
