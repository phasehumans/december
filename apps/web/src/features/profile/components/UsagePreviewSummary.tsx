import React from 'react'

import type { UsageEvent } from '@/features/billing/api/billing'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`
    if (tokens >= 10_000) return `${Math.round(tokens / 1000)}k`
    return tokens.toLocaleString()
}

const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex flex-col gap-1.5 bg-[#191919] rounded-xl px-3.5 py-3 min-w-0">
        <span className="text-[12px] font-medium text-[#7B7A79]">{label}</span>
        <span className="text-[18px] font-medium font-mono leading-none tracking-tight text-[#D6D5C9] truncate">
            {value}
        </span>
    </div>
)

/**
 * Three numbers and a bar chart above the usage table (N5-B). Ui only: both are worked out
 * from the rows that are loaded, so they are right only while all rows fit on one page.
 * The server part (issue 638) sends totals and a cost for each day of the whole range.
 */
export const UsagePreviewSummary: React.FC<{ events: UsageEvent[]; timeRange: string }> = ({
    events,
    timeRange,
}) => {
    const summary = React.useMemo(() => {
        const isDay = timeRange === '1d'
        const step = isDay ? HOUR_MS : DAY_MS
        const count = isDay ? 24 : timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30
        const end = Date.now()
        const start = end - count * step
        const buckets = Array.from({ length: count }, (_, index) => ({
            at: new Date(start + (index + 1) * step),
            cents: 0,
        }))

        let cents = 0
        let tokens = 0
        const sessions = new Set<string>()
        for (const event of events) {
            tokens += event.totalTokens
            const sessionKey = event.projectId || event.chatId || event.session?.title
            if (sessionKey) sessions.add(sessionKey)
            // own-key runs are paid by the user's provider, so they are not December spend
            if (event.billingSource === 'OWN_KEY') continue
            cents += event.costInCents
            const index = Math.floor((new Date(event.createdAt).getTime() - start) / step)
            const bucket = buckets[Math.min(Math.max(index, 0), count - 1)]
            if (bucket) bucket.cents += event.costInCents
        }
        const max = Math.max(...buckets.map((bucket) => bucket.cents), 1)
        return { buckets, cents, tokens, sessions: sessions.size, max, isDay }
    }, [events, timeRange])

    const labelOf = (date: Date) =>
        summary.isDay
            ? date.toLocaleTimeString('en-US', { hour: 'numeric' })
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const first = summary.buckets[0]
    const middle = summary.buckets[Math.floor(summary.buckets.length / 2)]
    const last = summary.buckets[summary.buckets.length - 1]

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
                <Tile label="Spent" value={formatUsd(summary.cents)} />
                <Tile label="Tokens" value={formatTokens(summary.tokens)} />
                <Tile label="Sessions" value={String(summary.sessions)} />
            </div>

            {/* one series, bars start at zero, each bar names its time and amount on hover or focus.
                no chart when nothing was spent: an empty plot says nothing */}
            {summary.cents > 0 && (
                <div
                    role="img"
                    aria-label={`Spend for each ${summary.isDay ? 'hour' : 'day'}. Total ${formatUsd(summary.cents)}.`}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-[10.5px] text-[#7B7A79] tabular-nums"
                >
                    <div className="flex flex-col justify-between text-right h-16">
                        <span>{formatUsd(summary.max)}</span>
                        <span>$0</span>
                    </div>
                    <div className="flex items-end gap-[2px] h-16 border-b border-[#383736]">
                        {summary.buckets.map((bucket, index) => (
                            <div
                                key={index}
                                tabIndex={0}
                                className="group relative flex-1 h-full flex items-end outline-none"
                            >
                                <div
                                    className="w-full rounded-t-[3px] bg-[#87B2F4] group-hover:bg-[#A3C7FF] group-focus:bg-[#A3C7FF]"
                                    style={{ height: `${(bucket.cents / summary.max) * 100}%` }}
                                />
                                <span
                                    className={`pointer-events-none absolute bottom-full mb-1 hidden group-hover:block group-focus:block whitespace-nowrap rounded-md border border-[#282828] bg-[#1F1F1F] px-1.5 py-0.5 text-[10.5px] text-[#EDEDEF] z-10 ${
                                        index < summary.buckets.length / 2 ? 'left-0' : 'right-0'
                                    }`}
                                >
                                    {labelOf(bucket.at)} · {formatUsd(bucket.cents)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <span />
                    <div className="flex justify-between">
                        <span>{first ? labelOf(first.at) : ''}</span>
                        <span>{middle ? labelOf(middle.at) : ''}</span>
                        <span>{last ? labelOf(last.at) : ''}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
