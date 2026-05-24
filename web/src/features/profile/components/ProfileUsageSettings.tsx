import {
    Calendar,
    ChevronDown,
    Download,
    ArrowUpRight,
    ExternalLink,
    Info,
    ChevronLeft,
    ChevronRight,
    UserCircle,
    Loader2,
    Image,
} from 'lucide-react'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { profileAPI } from '@/features/profile/api/profile'
import { useCreditsHistory, useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'

export const ProfileUsageSettings: React.FC = () => {
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
    })

    const { data: overview } = useBillingOverview()

    const [limit, setLimit] = useState(10) // Set default to 10 matching screenshot
    const [offset, setOffset] = useState(0)

    const { data: history, isLoading, error } = useCreditsHistory({ limit, offset })

    const [timeRange, setTimeRange] = useState('90d')

    const getEventLabel = (model: string) => {
        if (/image|img|gen/i.test(model)) return 'Image Generation'
        return 'Message'
    }

    const formatPeriodRange = (start?: string, end?: string) => {
        if (!start || !end) return 'Current Period'
        const s = new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        const e = new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return `${s} - ${e}`
    }

    const formatRowDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString(undefined, {
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

    const handleDownloadCSV = () => {
        if (!history || !history.events || history.events.length === 0) return

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

        for (const event of history.events) {
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
            csvRows.push(values.map((val) => `"${val}"`).join(','))
        }

        const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `december_usage_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = history ? Math.max(Math.ceil(history.total / limit), 1) : 1

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Usage</h1>
                <div className="flex flex-col border-t border-[#242323] pt-6">
                    {/* Controls Row */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors text-[13px] font-medium bg-[#171615]">
                                <Calendar className="w-4 h-4 text-[#7B7A79]" />
                                <span>
                                    {formatPeriodRange(overview?.periodStart, overview?.periodEnd)}
                                </span>
                                <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
                            </button>
                            <div className="flex items-center gap-1 bg-[#100E12] p-0.5 rounded-lg border border-[#242323]">
                                {['1d', '7d', '30d', '90d'].map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all ${
                                            range === timeRange
                                                ? 'bg-[#2B2A29] text-[#D6D5C9] shadow-sm'
                                                : 'text-[#7B7A79] hover:text-[#D6D5C9]'
                                        }`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={handleDownloadCSV}
                            disabled={!history || history.events.length === 0}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] bg-[#171615] transition-colors text-[13px] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            <Download className="w-4 h-4 text-[#7B7A79]" />
                            <span>Download</span>
                        </button>
                    </div>

                    {/* Table / Loader / Error */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 border border-[#242323] rounded-xl bg-[#100E12]">
                            <Loader2 className="w-8 h-8 animate-spin text-[#D6D5C9] mb-4" />
                            <span className="text-[13px] text-[#7B7A79]">
                                Loading usage history...
                            </span>
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
                                Any API calls or messages will appear here.
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
