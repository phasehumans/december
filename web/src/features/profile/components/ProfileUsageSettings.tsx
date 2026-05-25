import { useQuery } from '@tanstack/react-query'
import {
    Calendar,
    ChevronDown,
    Download,
    ExternalLink,
    Info,
    ChevronLeft,
    ChevronRight,
    UserCircle,
    Loader2,
    Image,
    Check,
} from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'

import { billingAPI } from '@/features/billing/api/billing'
import { useCreditsHistory, useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { profileAPI } from '@/features/profile/api/profile'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Skeleton } from '@/shared/components/ui/Skeleton'

interface BillingPeriod {
    start: string
    end: string
    label: string
}

export const ProfileUsageSettings: React.FC = () => {
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
    })

    const { data: overview, isLoading: isOverviewLoading } = useBillingOverview()

    const [limit, setLimit] = useState(10)
    const [offset, setOffset] = useState(0)

    const [filterType, setFilterType] = useState<'cycle' | 'quick'>('cycle')
    const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod | null>(null)
    const [timeRange, setTimeRange] = useState<string>('30d')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const getEventLabel = (model: string) => {
        if (/image|img|gen/i.test(model)) return 'Image Generation'
        return 'Message'
    }

    const formatPeriodRange = (start?: string, end?: string) => {
        if (!start || !end) return 'Current Period'
        const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return `${s} - ${e}`
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
        if (history && offset + limit < history.total) {
            setOffset((prev) => prev + limit)
        }
    }

    // Dynamic Period List Generator starting from database active billing period
    const currentPeriod = React.useMemo<BillingPeriod | null>(() => {
        if (!overview?.periodStart || !overview?.periodEnd) return null
        return {
            start: overview.periodStart,
            end: overview.periodEnd,
            label: formatPeriodRange(overview.periodStart, overview.periodEnd),
        }
    }, [overview])

    const periodsList = React.useMemo<BillingPeriod[]>(() => {
        if (!currentPeriod) return []
        const list = [currentPeriod]

        const curStart = new Date(currentPeriod.start)
        const curEnd = new Date(currentPeriod.end)

        // Generate 3 past monthly cycles
        for (let i = 1; i <= 3; i++) {
            const start = new Date(curStart)
            start.setMonth(start.getMonth() - i)
            const end = new Date(curEnd)
            end.setMonth(end.getMonth() - i)

            list.push({
                start: start.toISOString(),
                end: end.toISOString(),
                label: formatPeriodRange(start.toISOString(), end.toISOString()),
            })
        }
        return list
    }, [currentPeriod])

    // Compute active date range dynamically
    const activeDateRange = React.useMemo(() => {
        if (filterType === 'cycle') {
            const period = selectedPeriod || currentPeriod
            if (!period) return null
            return {
                start: period.start,
                end: period.end,
                label: period.label,
            }
        } else {
            const end = new Date()
            const start = new Date()
            let days = 30
            if (timeRange === '1d') days = 1
            else if (timeRange === '7d') days = 7
            else if (timeRange === '30d') days = 30
            else if (timeRange === '90d') days = 90

            start.setDate(end.getDate() - days)

            const startStr = start.toISOString()
            const endStr = end.toISOString()

            return {
                start: startStr,
                end: endStr,
                label: formatPeriodRange(startStr, endStr),
            }
        }
    }, [filterType, selectedPeriod, currentPeriod, timeRange])

    // Fetch credits history passing active period filter
    const {
        data: history,
        isLoading: isHistoryLoading,
        error,
    } = useCreditsHistory({
        limit,
        offset,
        periodStart: activeDateRange?.start,
        periodEnd: activeDateRange?.end,
    })

    // Reset offset to 0 when date filters or limits change
    useEffect(() => {
        setOffset(0)
    }, [activeDateRange?.start, activeDateRange?.end, limit])

    // Robust Blob-based CSV Downloader for full periods
    const handleDownloadCSV = async () => {
        if (!activeDateRange) return
        setIsDownloading(true)
        try {
            const response = await billingAPI.getCreditsHistory({
                limit: 1000, // Fetch up to 1000 items for period download
                offset: 0,
                periodStart: activeDateRange.start,
                periodEnd: activeDateRange.end,
            })

            const eventsToExport = response.events || []
            if (eventsToExport.length === 0) return

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

            for (const event of eventsToExport) {
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

    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = history ? Math.max(Math.ceil(history.total / limit), 1) : 1

    const isLoading = isOverviewLoading || isHistoryLoading

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Usage</h1>
                <div className="flex flex-col border-t border-[#242323] pt-6">
                    {/* Controls Row */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            {/* Date Dropdown Trigger */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors text-[13px] font-medium bg-[#171615] outline-none"
                                >
                                    <Calendar className="w-4 h-4 text-[#7B7A79]" />
                                    <span>
                                        {activeDateRange ? activeDateRange.label : 'Current Period'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
                                </button>

                                {isDropdownOpen && periodsList.length > 0 && (
                                    <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl border border-[#383736] bg-[#1E1D1C] py-2 shadow-2xl z-50 flex flex-col gap-[2px] animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold text-[#7B7A79] border-b border-[#242323] mb-1 uppercase tracking-wider">
                                            Billing Cycles
                                        </div>
                                        {periodsList.map((period, i) => {
                                            const isSelected =
                                                filterType === 'cycle' &&
                                                activeDateRange?.start === period.start
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        setSelectedPeriod(period)
                                                        setFilterType('cycle')
                                                        setIsDropdownOpen(false)
                                                    }}
                                                    className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors text-left"
                                                >
                                                    <span>{period.label}</span>
                                                    {isSelected && (
                                                        <Check className="w-3.5 h-3.5 text-[#D6D5C9]" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 1d 7d 30d 90d Quick Filters */}
                            <div className="flex items-center gap-1 bg-[#100E12] p-0.5 rounded-lg border border-[#242323]">
                                {['1d', '7d', '30d', '90d'].map((range) => {
                                    const isHighlighted =
                                        filterType === 'quick' && range === timeRange
                                    return (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setTimeRange(range)
                                                setFilterType('quick')
                                            }}
                                            className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all ${
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
                        </div>
                        <button
                            onClick={handleDownloadCSV}
                            disabled={!history || history.total === 0 || isLoading || isDownloading}
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
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-[140px_140px_130px_120px_1fr_75px] items-center py-4 px-5 border-b border-[#242323]/50 last:border-b-0"
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
                    ) : !history || history.events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 border border-[#242323] rounded-xl bg-[#100E12] text-[#7B7A79]">
                            <span className="text-[14px] font-medium mb-1">
                                No usage data found
                            </span>
                            <span className="text-[13px]">
                                Any API calls or messages in this period will appear here.
                            </span>
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
                            <div className="flex flex-col divide-y divide-[#242323]/50">
                                {history.events.map((row) => (
                                    <div
                                        key={row.id}
                                        className="grid grid-cols-[140px_140px_130px_120px_1fr_75px] items-center py-4 px-5 text-[13px] hover:bg-[#1A1918] transition-colors"
                                    >
                                        {/* Date */}
                                        <div className="text-[#D6D5C9]">
                                            {formatRowDate(row.createdAt)}
                                        </div>

                                        {/* User */}
                                        <div className="flex items-center gap-2 text-[#D6D5C9] pr-2">
                                            <UserCircle
                                                className="w-4 h-4 text-[#7B7A79]"
                                                strokeWidth={1.8}
                                            />
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
                                            <Info
                                                className="w-3.5 h-3.5 text-[#7B7A79] cursor-help"
                                                title={`Tokens: ${row.totalTokens} (In: ${row.inputTokens}, Out: ${row.outputTokens})`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer Controls */}
                    {history && history.total > 0 && (
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
                                        disabled={offset + limit >= history.total}
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
