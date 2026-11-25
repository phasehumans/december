import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useState } from 'react'

import {
    PAGE_SUBTITLES,
    listBoxClass,
    listEmptyClass,
    listHeaderClass,
    listRowsClass,
} from './settingsStyles'
import { SettingsPage } from './SettingsUi'
import { UsageSummary } from './UsageSummary'

import type { UsageBillingSource, UsageEvent } from '@/features/billing/api/billing'

import { useCreditsHistory, useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { ChoiceGroup } from '@/features/connections/components/ConnectionsUi'
import { profileAPI } from '@/features/profile/api/profile'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

/** label for usage rows that have no session, such as the daily AI search total */
const usageEventLabel = (row: UsageEvent): string | null => {
    if (row.metadata?.type !== 'search-filters') return null
    const calls = Number(row.metadata?.calls ?? 0)
    return calls > 1 ? `AI search (${calls} searches)` : 'AI search'
}

const RANGES = ['1d', '7d', '30d', '90d'].map((range) => ({ value: range, label: range }))

const HOUR_MS = 60 * 60 * 1000

type UsageSource = 'all' | 'credits' | 'keys'

const SOURCES: { value: UsageSource; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'credits', label: 'Credits' },
    { value: 'keys', label: 'Your keys' },
]

// what the "paid with" control sends. "all" sends nothing
const BILLING_SOURCE: Record<UsageSource, UsageBillingSource | undefined> = {
    all: undefined,
    credits: 'CREDITS',
    keys: 'OWN_KEY',
}

const NO_TOTALS = { costInCents: 0, totalTokens: 0, sessions: 0 }

/** the time zone of the browser: the days and hours of the chart are in it */
const browserTimezone = (): string | undefined => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
    } catch {
        // Intentionally swallowed: with no time zone the server uses the saved one
        return undefined
    }
}

export const ProfileUsageSettings: React.FC = () => {
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
    })

    const { data: overview, isLoading: isOverviewLoading } = useBillingOverview()

    const [limit, setLimit] = useState(10)
    const [offset, setOffset] = useState(0)

    const [timeRange, setTimeRange] = useState<string>('30d')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [source, setSource] = useState<UsageSource>('all')

    const formatRowDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    // Own-key runs are paid by the user's provider, so they show no December charge
    const formatRowCost = (row: { costInCents: number; billingSource?: 'CREDITS' | 'OWN_KEY' }) =>
        row.billingSource === 'OWN_KEY' ? 'your key' : `$${(row.costInCents / 100).toFixed(2)}`

    const formatModelName = (model: string) => {
        if (!model) return '-'
        const lower = model.toLowerCase()
        if (lower.includes('claude-sonnet')) return 'Claude Sonnet'
        if (lower.includes('claude-opus')) return 'Claude Opus'
        if (lower.includes('claude-haiku')) return 'Claude Haiku'
        if (lower.includes('gpt-4o')) return 'GPT-4o'
        if (lower.includes('gpt-4-turbo') || lower.includes('gpt-4t')) return 'GPT-4 Turbo'
        if (lower.includes('gpt-4')) return 'GPT-4'
        if (lower.includes('gpt-3.5') || lower.includes('gpt-35')) return 'GPT-3.5 Turbo'
        if (lower.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash'
        if (lower.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro'
        if (lower.includes('gemini-2') || lower.includes('gemini')) return 'Gemini'
        if (lower.includes('dall-e-3') || lower.includes('dalle3')) return 'DALL-E 3'
        if (lower.includes('dall-e-2') || lower.includes('dalle2')) return 'DALL-E 2'

        return model
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    }

    const handlePreviousPage = () => {
        if (offset >= limit) {
            setOffset((prev) => prev - limit)
        }
    }

    const handleNextPage = () => {
        // the count of every event of the range, not of the rows on this page
        if (offset + limit < totalEvents) {
            setOffset((prev) => prev + limit)
        }
    }

    // a new range or a new source starts at its first page
    const handleRangeChange = (range: string) => {
        setTimeRange(range)
        setOffset(0)
    }

    const handleSourceChange = (next: UsageSource) => {
        setSource(next)
        setOffset(0)
    }

    // the range of the quick filter, in whole bars of the chart: 1d is the hour that runs
    // now and the 23 hours before it, and 7d is today and the 6 days before it
    const activeDateRange = React.useMemo(() => {
        const end = new Date()
        let start = new Date(end)
        if (timeRange === '1d') {
            start.setMinutes(0, 0, 0)
            start = new Date(start.getTime() - 23 * HOUR_MS)
        } else {
            const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30
            start.setHours(0, 0, 0, 0)
            start.setDate(start.getDate() - (days - 1))
        }

        return {
            start: start.toISOString(),
            end: end.toISOString(),
            timezone: browserTimezone(),
        }
    }, [timeRange])

    // fetch credits history with server-side pagination
    const {
        data: history,
        isLoading: isHistoryLoading,
        error,
    } = useCreditsHistory({
        limit,
        offset,
        periodStart: activeDateRange.start,
        periodEnd: activeDateRange.end,
        billingSource: BILLING_SOURCE[source],
        timezone: activeDateRange.timezone,
    })

    // the server sums every event of the range. own-key runs are paid by the provider of
    // the user, so their cost is not in the total
    const totals = history?.totals ?? NO_TOTALS
    const paginatedEvents = history?.events ?? []
    const totalEvents = history?.total ?? 0
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.max(Math.ceil(totalEvents / limit), 1)

    const isLoading = isOverviewLoading || isHistoryLoading || isSkeletonPreviewActive()

    return (
        <SettingsPage title="Usage" subtitle={PAGE_SUBTITLES.usage}>
            <div className="flex flex-col gap-4">
                {/* controls row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* quick filters: the same two-part switch as "Send with" on Account */}
                        <ChoiceGroup
                            label="Period"
                            options={RANGES}
                            value={timeRange}
                            onChange={handleRangeChange}
                        />
                        <ChoiceGroup
                            label="Paid with"
                            options={SOURCES}
                            value={source}
                            onChange={handleSourceChange}
                        />
                    </div>

                    {/* total spent in place of download button */}
                    {isLoading ? (
                        <div className="flex items-center gap-1.5 text-[13px] text-[#9A9998]">
                            <span>Total spent:</span>
                            <Skeleton className="h-4 w-12 bg-white/[0.06] rounded" />
                        </div>
                    ) : (
                        <div className="text-[13px] text-[#9A9998]">
                            Total spent:{' '}
                            <span className="text-[#D6D5C9] font-medium">
                                ${(totals.costInCents / 100).toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>

                {!isLoading && !error && history && (
                    <UsageSummary totals={totals} days={history.days ?? []} hours={history.hours} />
                )}

                {/* table / loader / error */}
                {isLoading ? (
                    <div className={listBoxClass}>
                        <div className={listHeaderClass}>
                            <div className="flex md:hidden items-center justify-between">
                                <span>Project / Date</span>
                                <span>Tokens / Cost</span>
                            </div>
                            <div className="hidden md:grid grid-cols-[130px_200px_1fr_100px_70px] items-center">
                                <div>Date</div>
                                <div>Project</div>
                                <div>Model</div>
                                <div>Tokens</div>
                                <div className="text-right">Cost</div>
                            </div>
                        </div>
                        {/* Mobile skeletons (< md) */}
                        <div className="flex md:hidden flex-col divide-y divide-[#2A2A2A]">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-3.5 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <Skeleton className="h-4 w-28 bg-white/[0.05] rounded" />
                                        <Skeleton className="h-3.5 w-12 bg-white/[0.03] rounded" />
                                    </div>
                                    <Skeleton className="h-3 w-40 bg-white/[0.03] rounded" />
                                </div>
                            ))}
                        </div>
                        {/* Desktop skeletons (>= md) */}
                        <div className="hidden md:flex flex-col divide-y divide-[#2A2A2A]">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-[130px_200px_1fr_100px_70px] items-center py-3 px-4"
                                >
                                    <div className="pr-4">
                                        <Skeleton className="h-3.5 w-20 bg-white/[0.05] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-3.5 w-24 bg-white/[0.03] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-3.5 w-20 bg-white/[0.03] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-3.5 w-14 bg-white/[0.03] rounded" />
                                    </div>
                                    <div className="flex justify-end pr-1">
                                        <Skeleton className="h-3.5 w-10 bg-white/[0.05] rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <>
                        <p className="text-[13px] text-[#7B7A79]">
                            Usage did not load. Reload the page to try again.
                        </p>
                        <ErrorAlert message={(error as any)?.message || 'Usage did not load'} />
                    </>
                ) : (
                    <div className={listBoxClass}>
                        {/* Table Header: the same band as the Secrets list */}
                        <div className={listHeaderClass}>
                            {/* Mobile Header (< md) */}
                            <div className="flex md:hidden items-center justify-between">
                                <span>Project / Date</span>
                                <span>Tokens / Cost</span>
                            </div>

                            {/* Desktop Header (>= md) */}
                            <div className="hidden md:grid grid-cols-[130px_200px_1fr_100px_70px] items-center">
                                <div>Date</div>
                                <div>Project</div>
                                <div>Model</div>
                                <div>Tokens</div>
                                <div className="text-right">Cost</div>
                            </div>
                        </div>

                        {/* Table Body */}
                        {paginatedEvents.length === 0 ? (
                            <div className={listEmptyClass}>No usage in this period</div>
                        ) : (
                            <div className={listRowsClass}>
                                {paginatedEvents.map((row) => (
                                    <div key={row.id} className="flex flex-col">
                                        {/* Mobile row (< md) */}
                                        <div className="md:hidden p-3.5 flex flex-col gap-1.5 text-[13px]">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium text-[#D6D5C9] truncate">
                                                    {row.session?.title ||
                                                        row.project?.name ||
                                                        usageEventLabel(row) ||
                                                        'Workspace event'}
                                                </span>
                                                <span className="font-mono font-medium text-[#D6D5C9] shrink-0">
                                                    {formatRowCost(row)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between font-sans text-[11.5px] text-[#7B7A79]">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span>{formatRowDate(row.createdAt)}</span>
                                                    <span>•</span>
                                                    <span className="truncate">
                                                        {formatModelName(row.model)}
                                                    </span>
                                                </div>
                                                <span className="font-mono text-[#7B7A79] shrink-0">
                                                    {row.totalTokens.toLocaleString()} tokens
                                                </span>
                                            </div>
                                        </div>

                                        {/* Desktop row (>= md) */}
                                        <div className="hidden md:grid grid-cols-[130px_200px_1fr_100px_70px] items-center px-4 py-3 text-[13px]">
                                            <div className="font-sans text-[13px] text-[#7B7A79]">
                                                {formatRowDate(row.createdAt)}
                                            </div>
                                            <div className="text-[#D6D5C9] truncate pr-2 font-medium">
                                                {row.session?.title ||
                                                    row.project?.name ||
                                                    usageEventLabel(row) ||
                                                    '-'}
                                            </div>
                                            <div className="text-[#7B7A79] truncate pr-2">
                                                {formatModelName(row.model)}
                                            </div>
                                            <div className="text-[#D6D5C9] font-mono text-[12px]">
                                                {row.totalTokens.toLocaleString()}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[#D6D5C9] font-mono font-medium">
                                                    {formatRowCost(row)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* footer controls */}
                {/* phones: no "Show" control, and the pager shows only with a second page */}
                {totalEvents > 0 && (
                    <div
                        className={`items-center justify-between mt-5 ${totalPages > 1 ? 'flex' : 'hidden md:flex'}`}
                    >
                        {/* left limit selector */}
                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-[12.5px] text-[#7B7A79]">Show</span>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center justify-between w-[70px] bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg px-2.5 py-1 text-[12.5px] text-[#D6D5C9] hover:bg-[#242424] transition-colors focus:outline-none focus:border-[#7B7A79] font-medium cursor-pointer"
                                >
                                    <span>{limit}</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-[#7B7A79]" />
                                </button>

                                {isDropdownOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setIsDropdownOpen(false)}
                                        />
                                        <div className="absolute bottom-full left-0 mb-1 z-20 w-[70px] bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg shadow-xl overflow-hidden py-1">
                                            {[10, 20, 30].map((num) => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => {
                                                        setLimit(num)
                                                        setOffset(0)
                                                        setIsDropdownOpen(false)
                                                    }}
                                                    className={`w-full text-left px-2.5 py-1 text-[12.5px] transition-colors cursor-pointer ${
                                                        limit === num
                                                            ? 'bg-[#2B2A29] text-[#D6D5C9] font-medium'
                                                            : 'text-[#7B7A79] hover:bg-[#202020] hover:text-[#D6D5C9]'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* right page selectors */}
                        <div className="flex items-center gap-4 text-[12.5px] text-[#7B7A79] font-medium">
                            <span>
                                {currentPage} of {totalPages}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    aria-label="Previous page"
                                    onClick={handlePreviousPage}
                                    disabled={offset === 0}
                                    className="p-1.5 rounded-lg border border-[#383736] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#191919] transition-colors bg-[#141414] text-[#D6D5C9]"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Next page"
                                    onClick={handleNextPage}
                                    disabled={offset + limit >= totalEvents}
                                    className="p-1.5 rounded-lg border border-[#383736] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#191919] transition-colors bg-[#141414] text-[#D6D5C9]"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SettingsPage>
    )
}
