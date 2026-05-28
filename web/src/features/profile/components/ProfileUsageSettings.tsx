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
    // --- Within 1 Day ---
    {
        id: 'mock-1',
        createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 8,
        inputTokens: 1240,
        outputTokens: 860,
        totalTokens: 2100,
        project: { name: 'December Portfolio' },
    },
    {
        id: 'mock-2',
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
        model: 'gpt-4o',
        costInCents: 12,
        inputTokens: 2100,
        outputTokens: 1400,
        totalTokens: 3500,
        project: { name: 'Landing Page' },
    },
    {
        id: 'mock-3',
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 5,
        inputTokens: 800,
        outputTokens: 420,
        totalTokens: 1220,
        project: { name: 'December Portfolio' },
    },
    {
        id: 'mock-4',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
        model: 'dall-e-3',
        costInCents: 20,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        project: { name: 'Marketing Asset Gen' },
    },
    {
        id: 'mock-5',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
        model: 'gemini-2.5-flash',
        costInCents: 3,
        inputTokens: 640,
        outputTokens: 310,
        totalTokens: 950,
        project: { name: 'Dashboard Widget' },
    },
    {
        id: 'mock-6',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // 18 hours ago
        model: 'gpt-4o',
        costInCents: 14,
        inputTokens: 2300,
        outputTokens: 1200,
        totalTokens: 3500,
        project: { name: 'AI Chatbot UI' },
    },
    // --- Within 2-7 Days (7d) ---
    {
        id: 'mock-7',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), // 1.1 days ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 15,
        inputTokens: 3200,
        outputTokens: 1800,
        totalTokens: 5000,
        project: { name: 'December Portfolio' },
    },
    {
        id: 'mock-8',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        model: 'gpt-4o',
        costInCents: 9,
        inputTokens: 1800,
        outputTokens: 920,
        totalTokens: 2720,
        project: { name: 'AI Chatbot UI' },
    },
    {
        id: 'mock-9',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
        model: 'gemini-2.5-flash',
        costInCents: 4,
        inputTokens: 520,
        outputTokens: 280,
        totalTokens: 800,
        project: { name: 'E-commerce API' },
    },
    {
        id: 'mock-10',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 days ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 11,
        inputTokens: 2400,
        outputTokens: 1100,
        totalTokens: 3500,
        project: { name: 'Dashboard Widget' },
    },
    {
        id: 'mock-11',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), // 5 days ago
        model: 'dall-e-3',
        costInCents: 20,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        project: { name: 'Marketing Asset Gen' },
    },
    {
        id: 'mock-12',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(), // 6 days ago
        model: 'gpt-4o',
        costInCents: 18,
        inputTokens: 3100,
        outputTokens: 1900,
        totalTokens: 5000,
        project: { name: 'Landing Page' },
    },
    // --- Within 8-30 Days (30d) ---
    {
        id: 'mock-13',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(), // 9 days ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 22,
        inputTokens: 4200,
        outputTokens: 2500,
        totalTokens: 6700,
        project: { name: 'December Portfolio' },
    },
    {
        id: 'mock-14',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(), // 12 days ago
        model: 'gemini-2.5-pro',
        costInCents: 10,
        inputTokens: 1500,
        outputTokens: 1100,
        totalTokens: 2600,
        project: { name: 'E-commerce API' },
    },
    {
        id: 'mock-15',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(), // 15 days ago
        model: 'gpt-4o',
        costInCents: 6,
        inputTokens: 1100,
        outputTokens: 500,
        totalTokens: 1600,
        project: { name: 'AI Chatbot UI' },
    },
    {
        id: 'mock-16',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(), // 18 days ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 12,
        inputTokens: 2500,
        outputTokens: 1300,
        totalTokens: 3800,
        project: { name: 'Dashboard Widget' },
    },
    {
        id: 'mock-17',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 22).toISOString(), // 22 days ago
        model: 'dall-e-3',
        costInCents: 20,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        project: { name: 'Marketing Asset Gen' },
    },
    {
        id: 'mock-18',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString(), // 25 days ago
        model: 'gemini-2.5-flash',
        costInCents: 2,
        inputTokens: 500,
        outputTokens: 250,
        totalTokens: 750,
        project: { name: 'Dashboard Widget' },
    },
    {
        id: 'mock-19',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString(), // 28 days ago
        model: 'gpt-4o',
        costInCents: 15,
        inputTokens: 2800,
        outputTokens: 1700,
        totalTokens: 4500,
        project: { name: 'Landing Page' },
    },
    // --- Within 31-90 Days (90d) ---
    {
        id: 'mock-20',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString(), // 35 days ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 17,
        inputTokens: 3000,
        outputTokens: 2100,
        totalTokens: 5100,
        project: { name: 'December Portfolio' },
    },
    {
        id: 'mock-21',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 42).toISOString(), // 42 days ago
        model: 'gpt-4o',
        costInCents: 13,
        inputTokens: 2200,
        outputTokens: 1400,
        totalTokens: 3600,
        project: { name: 'AI Chatbot UI' },
    },
    {
        id: 'mock-22',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 48).toISOString(), // 48 days ago
        model: 'gemini-2.5-pro',
        costInCents: 9,
        inputTokens: 1400,
        outputTokens: 900,
        totalTokens: 2300,
        project: { name: 'E-commerce API' },
    },
    {
        id: 'mock-23',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 55).toISOString(), // 55 days ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 8,
        inputTokens: 1500,
        outputTokens: 900,
        totalTokens: 2400,
        project: { name: 'December Portfolio' },
    },
    {
        id: 'mock-24',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 62).toISOString(), // 62 days ago
        model: 'dall-e-3',
        costInCents: 20,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        project: { name: 'Marketing Asset Gen' },
    },
    {
        id: 'mock-25',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 68).toISOString(), // 68 days ago
        model: 'gpt-4o',
        costInCents: 11,
        inputTokens: 1900,
        outputTokens: 1100,
        totalTokens: 3000,
        project: { name: 'Landing Page' },
    },
    {
        id: 'mock-26',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 75).toISOString(), // 75 days ago
        model: 'gemini-2.5-flash',
        costInCents: 4,
        inputTokens: 700,
        outputTokens: 350,
        totalTokens: 1050,
        project: { name: 'Dashboard Widget' },
    },
    {
        id: 'mock-27',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 82).toISOString(), // 82 days ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 19,
        inputTokens: 3500,
        outputTokens: 2200,
        totalTokens: 5700,
        project: { name: 'December Portfolio' },
    },
    {
        id: 'mock-28',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 88).toISOString(), // 88 days ago
        model: 'gpt-4o',
        costInCents: 16,
        inputTokens: 2700,
        outputTokens: 1600,
        totalTokens: 4300,
        project: { name: 'AI Chatbot UI' },
    },
    // --- Older than 90 Days (Should be hidden by range filters) ---
    {
        id: 'mock-29',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 95).toISOString(), // 95 days ago
        model: 'gemini-2.5-pro',
        costInCents: 10,
        inputTokens: 1600,
        outputTokens: 1000,
        totalTokens: 2600,
        project: { name: 'E-commerce API' },
    },
    {
        id: 'mock-30',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 105).toISOString(), // 105 days ago
        model: 'claude-sonnet-4-20250514',
        costInCents: 14,
        inputTokens: 2800,
        outputTokens: 1500,
        totalTokens: 4300,
        project: { name: 'Dashboard Widget' },
    },
    {
        id: 'mock-31',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(), // 120 days ago
        model: 'gpt-4o',
        costInCents: 22,
        inputTokens: 4000,
        outputTokens: 2400,
        totalTokens: 6400,
        project: { name: 'Landing Page' },
    },
    {
        id: 'mock-32',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 150).toISOString(), // 150 days ago
        model: 'dall-e-3',
        costInCents: 20,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        project: { name: 'Marketing Asset Gen' },
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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

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

    // Use real data if available, otherwise mock. Apply date filtering on frontend.
    const displayEvents = React.useMemo(() => {
        const events =
            history && history.events && history.events.length > 0
                ? history.events
                : MOCK_USAGE_EVENTS

        const startTime = new Date(activeDateRange.start).getTime()
        const endTime = new Date(activeDateRange.end).getTime()

        return events.filter((event) => {
            const eventTime = new Date(event.createdAt).getTime()
            return eventTime >= startTime && eventTime <= endTime
        })
    }, [history, activeDateRange])

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
                'Project',
                'Model',
                'Token Usage',
                'Cost ($)',
                'Input Tokens',
                'Output Tokens',
            ]
            const csvRows = [headers.join(',')]

            for (const event of displayEvents) {
                const date = new Date(event.createdAt).toISOString()
                const project = event.project?.name || '-'
                const cost = (event.costInCents / 100).toFixed(4)

                const values = [
                    date,
                    project,
                    event.model,
                    event.totalTokens,
                    cost,
                    event.inputTokens,
                    event.outputTokens,
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
                            <div className="grid grid-cols-[130px_1fr_140px_100px_70px] items-center py-3.5 px-5 border-b border-[#242323] bg-[#171615] text-[12px] text-[#7B7A79] font-medium">
                                <div>Date</div>
                                <div>Project</div>
                                <div>Model</div>
                                <div>Token Usage</div>
                                <div className="text-right">Cost</div>
                            </div>
                            {/* Table rows skeleton */}
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-[130px_1fr_140px_100px_70px] items-center py-5 px-5 border-b border-[#242323]/50 last:border-b-0"
                                >
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-24 bg-white/[0.06] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-20 bg-white/[0.04] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-24 bg-white/[0.04] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-14 bg-white/[0.04] rounded" />
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
                            <div className="grid grid-cols-[130px_1fr_140px_100px_70px] items-center py-3.5 px-5 border-b border-[#242323] bg-[#171615] text-[12px] text-[#7B7A79] font-medium">
                                <div>Date</div>
                                <div>Project</div>
                                <div>Model</div>
                                <div>Token Usage</div>
                                <div className="text-right">Cost</div>
                            </div>

                            {/* Rows */}
                            <div className="flex flex-col divide-y divide-[#242323]/50 min-h-[420px]">
                                {paginatedEvents.map((row) => (
                                    <div
                                        key={row.id}
                                        className="grid grid-cols-[130px_1fr_140px_100px_70px] items-center py-5 px-5 text-[13px] hover:bg-[#1A1918] transition-colors"
                                    >
                                        {/* Date */}
                                        <div className="text-[#D6D5C9]">
                                            {formatRowDate(row.createdAt)}
                                        </div>

                                        {/* Project */}
                                        <div className="text-[#D6D5C9] truncate pr-2 font-medium">
                                            {row.project?.name || '-'}
                                        </div>

                                        {/* Model */}
                                        <div className="text-[#7B7A79] truncate pr-2">
                                            {formatModelName(row.model)}
                                        </div>

                                        {/* Token Usage */}
                                        <div className="text-[#D6D5C9] font-mono text-[12px]">
                                            {row.totalTokens.toLocaleString()}
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
                                    <button
                                        type="button"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="flex items-center justify-between w-[70px] bg-[#100E12] border border-[#383736] rounded-lg px-2.5 py-1 text-[12.5px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors focus:outline-none focus:border-[#7B7A79] font-medium"
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
                                            <div className="absolute bottom-full left-0 mb-1 z-20 w-[70px] bg-[#100E12] border border-[#242323] rounded-lg shadow-xl overflow-hidden py-1">
                                                {[10, 20, 30].map((num) => (
                                                    <button
                                                        key={num}
                                                        type="button"
                                                        onClick={() => {
                                                            setLimit(num)
                                                            setOffset(0)
                                                            setIsDropdownOpen(false)
                                                        }}
                                                        className={`w-full text-left px-2.5 py-1 text-[12.5px] transition-colors ${
                                                            num === limit
                                                                ? 'bg-[#2B2A29] text-[#D6D5C9] font-semibold'
                                                                : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
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
