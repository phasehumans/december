import { Check } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import { SoonTag } from '@/features/home/components/PromptMenus'
import { requestWorkspaceTab } from '@/features/preview/lib/workspaceTabRequest'
import {
    PULL_REQUEST_STATE_CLASS,
    PULL_REQUEST_STATE_LABELS,
    toPullRequestRows,
} from '@/features/pullrequests/lib/pullRequests'
import { RunStatus } from '@/features/sessions/components/ListParts'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import { OfficeCanvas } from '@/features/supercrew/components/OfficeCanvas'
import { useSuperCrewWaitlist } from '@/features/supercrew/hooks/useSuperCrewWaitlist'
import { Icons } from '@/shared/components/ui/Icons'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'
import { cn } from '@/shared/lib/utils'

// the tabs under the Home prompt box: Recent, Pull requests, Super Crew.
// Recent and Pull requests show the 5 newest rows. "View all" opens the full page.

type HomeTab = 'recent' | 'pull-requests' | 'super-crew'

const TABS: { id: HomeTab; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'pull-requests', label: 'Pull requests' },
    { id: 'super-crew', label: 'Super Crew' },
]
const ROW_LIMIT = 5
const STORAGE_KEY = 'december:home-tab'

const readSavedTab = (): HomeTab => {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        return TABS.some((tab) => tab.id === saved) ? (saved as HomeTab) : 'recent'
    } catch {
        // Intentionally swallowed: storage can be blocked, the first tab is used
        return 'recent'
    }
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

interface HomeTabsProps {
    onOpenProject?: (sessionId: string) => void
}

export const HomeTabs: React.FC<HomeTabsProps> = ({ onOpenProject }) => {
    const navigate = useNavigate()
    const [tab, setTab] = React.useState<HomeTab>(readSavedTab)
    const { data: sessionsData, isLoading: isSessionsLoading } = useSessions()
    const { state: waitlist, isLoading: isWaitlistLoading, join } = useSuperCrewWaitlist(true)

    const selectTab = (next: HomeTab) => {
        setTab(next)
        try {
            window.localStorage.setItem(STORAGE_KEY, next)
        } catch {
            // Intentionally swallowed: storage can be blocked, the tab is then not remembered
        }
    }

    const sessions = React.useMemo(
        () =>
            (sessionsData?.sessions || [])
                .filter((session) => !session.isArchived && session.type !== 'SEARCH')
                .sort(
                    (a, b) =>
                        (new Date(b.updatedAt).getTime() || 0) -
                        (new Date(a.updatedAt).getTime() || 0)
                ),
        [sessionsData?.sessions]
    )
    const recent = sessions.slice(0, ROW_LIMIT)
    const pullRequests = React.useMemo(
        () => toPullRequestRows(sessions).slice(0, ROW_LIMIT),
        [sessions]
    )

    const isLoading = isSessionsLoading || isSkeletonPreviewActive()
    const viewAllPath =
        tab === 'recent' && recent.length > 0
            ? '/sessions'
            : tab === 'pull-requests' && pullRequests.length > 0
              ? '/pull-requests'
              : null

    return (
        <div data-testid="home-tabs" className="mt-[18px] px-1.5 font-sans">
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <div
                    role="tablist"
                    className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar [scrollbar-width:none]"
                >
                    {TABS.map((item) => (
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
                            {item.id === 'super-crew' && <SoonTag />}
                        </button>
                    ))}
                </div>
                {viewAllPath && !isLoading && (
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
                    (isLoading ? (
                        <LoadingRows />
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
                                {session.vmStatus === 'RUNNING' ||
                                session.vmStatus === 'PROVISIONING' ? (
                                    // same words as the sidebar and the Sessions page
                                    <RunStatus vmStatus={session.vmStatus} className={metaClass} />
                                ) : (
                                    <span className={metaClass}>
                                        {session.prNumber ? `PR ${session.prNumber} · ` : ''}
                                        {formatRelativeTime(session.updatedAt)}
                                    </span>
                                )}
                            </button>
                        ))
                    ))}

                {tab === 'pull-requests' &&
                    (isLoading ? (
                        <LoadingRows />
                    ) : pullRequests.length === 0 ? (
                        <div className={emptyClass}>No pull requests yet.</div>
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

                {tab === 'super-crew' && (
                    // the horizontal strip: office on the left, name, one line and the button
                    <div className="mt-0.5 flex items-stretch overflow-hidden rounded-2xl border border-[#2A2928] bg-[#1E1E1E]">
                        <OfficeCanvas
                            compact
                            className="m-1.5 w-[92px] min-h-[92px] sm:w-[166px] shrink-0 overflow-hidden rounded-[10px] border border-[#2A2928] bg-[#121212]"
                        />
                        <div className="flex min-w-0 flex-1 flex-col items-start gap-[7px] py-2.5 pl-1 pr-3">
                            <div className="flex items-center gap-[7px] min-w-0">
                                <Icons.CrewDots className="w-3.5 h-3.5 text-[#D6D5D4] shrink-0" />
                                <span className="text-[12.5px] font-semibold text-[#EDEDED] truncate">
                                    Super Crew
                                </span>
                                <SoonTag />
                            </div>
                            <p className="text-[12px] leading-[1.45] text-[#919191]">
                                A crew of agents that keep working on your repo while you&apos;re
                                away.
                            </p>
                            {isWaitlistLoading ? (
                                // holds the button's place, so a user on the list never sees "Notify me"
                                <div className="mt-auto h-[28px]" aria-hidden="true" />
                            ) : waitlist?.joined ? (
                                <div className="mt-auto flex h-[28px] items-center gap-1.5 rounded-[8px] bg-[#252525] px-3 text-[12.5px] font-medium text-[#D6D5D4] select-none">
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
                                    className="mt-auto h-[28px] px-3 rounded-[8px] bg-[#E8E8E8] hover:bg-white text-[#141414] text-[12.5px] font-medium transition-colors cursor-pointer outline-none disabled:opacity-70 disabled:cursor-default"
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
