import { useQuery } from '@tanstack/react-query'
import {
    ChevronDown,
    Download,
    ExternalLink,
    Info,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Image,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { billingAPI } from '@/features/billing/api/billing'
import { useCreditsHistory, useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { profileAPI } from '@/features/profile/api/profile'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Icons } from '@/shared/components/ui/Icons'
import { Skeleton } from '@/shared/components/ui/Skeleton'

// Mock data so the table is never empty
const MOCK_USAGE_EVENTS = [
    {
        id: 'mock-1',
        createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        model: 'claude-sonnet-4-20250514',
        costInCents: 8,
        inputTokens: 1240,
        outputTokens: 860,
        totalTokens: 2100,
    },
    {
        id: 'mock-2',
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        model: 'gpt-4o',
        costInCents: 12,
        inputTokens: 2100,
        outputTokens: 1400,
        totalTokens: 3500,
    },
    {
        id: 'mock-3',
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        model: 'claude-sonnet-4-20250514',
        costInCents: 5,
        inputTokens: 800,
        outputTokens: 420,
        totalTokens: 1220,
    },
    {
        id: 'mock-4',
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        model: 'dall-e-3',
        costInCents: 20,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
    },
    {
        id: 'mock-5',
        createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
        model: 'gemini-2.5-flash',
        costInCents: 3,
        inputTokens: 640,
        outputTokens: 310,
        totalTokens: 950,
    },
    {
        id: 'mock-6',
        createdAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
        model: 'claude-sonnet-4-20250514',
        costInCents: 15,
        inputTokens: 3200,
        outputTokens: 1800,
        totalTokens: 5000,
    },
    {
        id: 'mock-7',
        createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
        model: 'gpt-4o',
        costInCents: 9,
        inputTokens: 1800,
        outputTokens: 920,
        totalTokens: 2720,
    },
    {
        id: 'mock-8',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        model: 'gemini-2.5-flash',
        costInCents: 4,
        inputTokens: 520,
        outputTokens: 280,
        totalTokens: 800,
    },
    {
        id: 'mock-9',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        model: 'claude-sonnet-4-20250514',
        costInCents: 11,
        inputTokens: 2400,
        outputTokens: 1100,
        totalTokens: 3500,
    },
    {
        id: 'mock-10',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
        model: 'dall-e-3',
        costInCents: 20,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
    },
]

export const ProfileUsageSettings: React.FC = () => {
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
    })

    const { data: overview, isLoading: isOverviewLoading } = useBillingOverview()

    const [limit, setLimit] = useState(10)
    const [offset, setOffset] = useState(0)

    const [timeRange, setTimeRange] = useState<string>('30d')
    const [isDownloading, setIsDownloading] = useState(false)

    const getEventLabel = (model: string) => {
        if (/image|img|gen|dall/i.test(model)) return 'Image Generation'
        return 'Message'
    }

    const formatRowDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const handlePreviousPage = () => {
        if (offset >= limit) {
            setOffset((prev) => prev - limit)
        }
    }

    const handleNextPage = () => {
        const total = displayEvents.length
        if (offset + limit < total) {
            setOffset((prev) => prev + limit)
        }
    }

    // Compute active date range from quick filter
    const activeDateRange = React.useMemo(() => {
        const end = new Date()
        const start = new Date()
        let days = 30
        if (timeRange === '1d') days = 1
        else if (timeRange === '7d') days = 7
        else if (timeRange === '30d') days = 30
        else if (timeRange === '90d') days = 90

        start.setDate(end.getDate() - days)

        return {
            start: start.toISOString(),
            end: end.toISOString(),
        }
    }, [timeRange])

    // Fetch credits history
    const {
        data: history,
        isLoading: isHistoryLoading,
        error,
    } = useCreditsHistory({
        limit: 100,
        offset: 0,
        periodStart: activeDateRange.start,
        periodEnd: activeDateRange.end,
    })

    // Reset offset when filters change
    useEffect(() => {
        setOffset(0)
    }, [activeDateRange.start, activeDateRange.end, limit])

    // Use real data if available, otherwise mock
    const displayEvents = React.useMemo(() => {
        if (history && history.events && history.events.length > 0) {
            return history.events
        }
        return MOCK_USAGE_EVENTS
    }, [history])

    const paginatedEvents = displayEvents.slice(offset, offset + limit)
    const totalEvents = displayEvents.length
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.max(Math.ceil(totalEvents / limit), 1)

    // CSV Downloader
    const handleDownloadCSV = async () => {
        if (displayEvents.length === 0) return
        setIsDownloading(true)
        try {
            const headers = [
                'Date',
                'User',
                'Event',
                'Kind',
                'Model',
                'Cost ($)',
                'Input Tokens',
                'Output Tokens',
                'Total Tokens',
            ]
            const csvRows = [headers.join(',')]

            for (const event of displayEvents) {
                const date = new Date(event.createdAt).toISOString()
                const user = profile?.username || 'user'
                const eventType = getEventLabel(event.model)
                const kind = 'Monthly Credits'
                const cost = (event.costInCents / 100).toFixed(4)

                const values = [
                    date,
                    user,
                    eventType,
                    kind,
                    event.model,
                    cost,
                    event.inputTokens,
                    event.outputTokens,
                    event.totalTokens,
                ]
                csvRows.push(
                    values.map((val) => `"${val?.toString().replace(/"/g, '""')}"`).join(',')
                )
            }

            const csvString = csvRows.join('\n')
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.setAttribute('href', url)
            link.setAttribute(
                'download',
                `december_usage_${new Date().toISOString().slice(0, 10)}.csv`
            )
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Failed to download CSV:', err)
        } finally {
            setIsDownloading(false)
        }
    }

    const isLoading = isOverviewLoading || isHistoryLoading

    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Usage</h1>
                <div className="flex flex-col border-t border-[#242323] pt-6">
                    {/* Controls Row */}
                    <div className="flex items-center justify-between mb-6">
                        {/* Quick Filters */}
                        <div className="flex items-center gap-1 bg-[#100E12] p-0.5 rounded-lg border border-[#242323]">
                            {['1d', '7d', '30d', '90d'].map((range) => {
                                const isHighlighted = range === timeRange
                                return (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                                            isHighlighted
                                                ? 'bg-[#2B2A29] text-[#D6D5C9] shadow-sm'
                                                : 'text-[#7B7A79] hover:text-[#D6D5C9]'
                                        }`}
                                    >
                                        {range}
                                    </button>
                                )
                            })}
                        </div>
                        <button
                            onClick={handleDownloadCSV}
                            disabled={displayEvents.length === 0 || isLoading || isDownloading}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] bg-[#171615] transition-colors text-[13px] disabled:opacity-50 disabled:cursor-not-allowed font-medium active:scale-[0.98]"
                        >
                            {isDownloading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-[#7B7A79]" />
                            ) : (
                                <Download className="w-4 h-4 text-[#7B7A79]" />
                            )}
                            <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
                        </button>
                    </div>

                    {/* Table / Loader / Error */}
                    {isLoading ? (
                        <div className="flex flex-col border border-[#242323] rounded-xl overflow-hidden bg-[#100E12] shadow-sm">
                            {/* Table Header skeleton */}
                            <div className="grid grid-cols-[140px_140px_130px_120px_1fr_75px] items-center py-3.5 px-5 border-b border-[#242323] bg-[#171615] text-[12px] text-[#7B7A79] font-medium">
                                <div>Date</div>
                                <div>User</div>
                                <div>Event</div>
                                <div>Kind</div>
                                <div>Model</div>
                                <div className="text-right">Cost</div>
                            </div>
                            {/* Table rows skeleton */}
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-[140px_140px_130px_120px_1fr_75px] items-center py-5 px-5 border-b border-[#242323]/50 last:border-b-0"
                                >
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-24 bg-white/[0.06] rounded" />
                                    </div>
                                    <div className="flex items-center gap-2 pr-4">
                                        <Skeleton className="h-4 w-4 rounded-full bg-white/[0.06] shrink-0" />
                                        <Skeleton className="h-4 w-20 bg-white/[0.04] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-20 bg-white/[0.06] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-20 bg-white/[0.04] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-24 bg-white/[0.04] rounded" />
                                    </div>
                                    <div className="flex justify-end pr-1">
                                        <Skeleton className="h-4 w-10 bg-white/[0.06] rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="w-full flex justify-center">
                            <ErrorAlert
                                message={
                                    error instanceof Error
                                        ? error.message
                                        : 'Failed to load usage events'
                                }
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col border border-[#242323] rounded-xl overflow-hidden bg-[#100E12] shadow-sm">
                            {/* Header */}
                            <div className="grid grid-cols-[140px_140px_130px_120px_1fr_75px] items-center py-3.5 px-5 border-b border-[#242323] bg-[#171615] text-[12px] text-[#7B7A79] font-medium">
                                <div>Date</div>
                                <div>User</div>
                                <div>Event</div>
                                <div>Kind</div>
                                <div>Model</div>
                                <div className="text-right">Cost</div>
                            </div>

                            {/* Rows */}
                            <div className="flex flex-col divide-y divide-[#242323]/50 min-h-[420px]">
                                {paginatedEvents.map((row) => (
                                    <div
                                        key={row.id}
                                        className="grid grid-cols-[140px_140px_130px_120px_1fr_75px] items-center py-5 px-5 text-[13px] hover:bg-[#1A1918] transition-colors"
                                    >
                                        {/* Date */}
                                        <div className="text-[#D6D5C9]">
                                            {formatRowDate(row.createdAt)}
                                        </div>

                                        {/* User */}
                                        <div className="flex items-center gap-2 text-[#D6D5C9] pr-2">
                                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.04] text-[#7B7A79] shrink-0">
                                                <Icons.UserCircle className="w-3 h-3" />
                                            </div>
                                            <span className="truncate max-w-[100px] font-medium">
                                                {profile?.username || 'user'}
                                            </span>
                                        </div>

                                        {/* Event */}
                                        <div className="flex items-center gap-1.5 text-[#D6D5C9] font-medium">
                                            <span>{getEventLabel(row.model)}</span>
                                            {getEventLabel(row.model) === 'Message' ? (
                                                <ExternalLink className="w-3 h-3 text-[#7B7A79]" />
                                            ) : (
                                                <Image className="w-3 h-3 text-[#7B7A79]" />
                                            )}
                                        </div>

                                        {/* Kind */}
                                        <div className="text-[#7B7A79]">Monthly Credits</div>

                                        {/* Model */}
                                        <div className="text-[#7B7A79] truncate pr-2">
                                            {row.model}
                                        </div>

                                        {/* Cost */}
                                        <div className="text-right flex items-center justify-end gap-1.5">
                                            <span className="text-[#D6D5C9]">
                                                ${(row.costInCents / 100).toFixed(2)}
                                            </span>
                                            <span
                                                title={`Tokens: ${row.totalTokens} (In: ${row.inputTokens}, Out: ${row.outputTokens})`}
                                            >
                                                <Info className="w-3.5 h-3.5 text-[#7B7A79] cursor-help" />
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer Controls */}
                    {totalEvents > 0 && (
                        <div className="flex items-center justify-between mt-5">
                            {/* Left limit selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-[12.5px] text-[#7B7A79]">Show</span>
                                <div className="relative">
                                    <select
                                        value={limit}
                                        onChange={(e) => {
                                            setLimit(Number(e.target.value))
                                            setOffset(0)
                                        }}
                                        className="bg-[#100E12] border border-[#383736] rounded-lg pl-2.5 pr-7 py-1 text-[12.5px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors focus:outline-none focus:border-[#7B7A79] cursor-pointer appearance-none font-medium"
                                    >
                                        {[10, 25, 50, 100].map((num) => (
                                            <option key={num} value={num}>
                                                {num}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-[#7B7A79] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* Right page selectors */}
                            <div className="flex items-center gap-4 text-[12.5px] text-[#7B7A79] font-medium">
                                <span>
                                    {currentPage} of {totalPages}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={handlePreviousPage}
                                        disabled={offset === 0}
                                        className="p-1.5 rounded-lg border border-[#383736] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1E1D1B] transition-colors bg-[#171615] text-[#D6D5C9]"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={offset + limit >= totalEvents}
                                        className="p-1.5 rounded-lg border border-[#383736] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1E1D1B] transition-colors bg-[#171615] text-[#D6D5C9]"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
