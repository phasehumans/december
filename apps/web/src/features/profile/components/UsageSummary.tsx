import React from 'react'

import type { UsageDay, UsageHour, UsageTotals } from '@/features/billing/api/billing'

import { formatTokenCount, formatUsd } from '@/shared/lib/format'

/** "Mar 9" for 2026-03-09. the date is a day of the calendar, so no time zone moves it */
const dayLabel = (date: string) => {
    const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    })
}

/** "3 PM" for 15 */
const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex flex-col gap-1.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl px-3.5 py-3 min-w-0">
        <span className="text-[12px] font-medium text-[#7B7A79]">{label}</span>
        <span className="text-[18px] font-medium font-mono leading-none tracking-tight text-[#D6D5C9] truncate">
            {value}
        </span>
    </div>
)

/**
 * Three numbers and a bar chart above the usage table (N5-B). The server sends all of it
 * for the whole range (issue 638): the totals, a cost for each day, and a cost for each
 * hour when the range is one day.
 */
export const UsageSummary: React.FC<{
    totals: UsageTotals
    days: UsageDay[]
    hours?: UsageHour[]
}> = ({ totals, days, hours }) => {
    const chart = React.useMemo(() => {
        const bars = hours
            ? hours.map((row) => ({ label: hourLabel(row.hour), cents: row.costInCents }))
            : days.map((row) => ({ label: dayLabel(row.date), cents: row.costInCents }))
        const max = Math.max(...bars.map((bar) => bar.cents), 1)
        return { bars, max, isDay: Boolean(hours) }
    }, [days, hours])

    const first = chart.bars[0]
    const middle = chart.bars[Math.floor(chart.bars.length / 2)]
    const last = chart.bars[chart.bars.length - 1]

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
                <Tile label="Spent" value={formatUsd(totals.costInCents)} />
                <Tile
                    label="Tokens"
                    value={formatTokenCount(totals.totalTokens, { precise: true })}
                />
                <Tile label="Sessions" value={String(totals.sessions)} />
            </div>

            {/* one series, bars start at zero, each bar names its time and amount on hover or focus.
                no chart when nothing was spent: an empty plot says nothing */}
            {totals.costInCents > 0 && chart.bars.length > 0 && (
                <div
                    role="img"
                    aria-label={`Spend for each ${chart.isDay ? 'hour' : 'day'}. Total ${formatUsd(totals.costInCents)}.`}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-[10.5px] text-[#7B7A79] tabular-nums"
                >
                    <div className="flex flex-col justify-between text-right h-16">
                        <span>{formatUsd(chart.max)}</span>
                        <span>$0</span>
                    </div>
                    <div className="flex items-end gap-[2px] h-16 border-b border-[#383736]">
                        {chart.bars.map((bar, index) => (
                            <div
                                key={index}
                                tabIndex={0}
                                className="group relative flex-1 h-full flex items-end outline-none"
                            >
                                <div
                                    className="w-full rounded-t-[3px] bg-[#87B2F4] group-hover:bg-[#A3C7FF] group-focus:bg-[#A3C7FF]"
                                    style={{ height: `${(bar.cents / chart.max) * 100}%` }}
                                />
                                <span
                                    className={`pointer-events-none absolute bottom-full mb-1 hidden group-hover:block group-focus:block whitespace-nowrap rounded-md border border-[#282828] bg-[#1F1F1F] px-1.5 py-0.5 text-[10.5px] text-[#EDEDEF] z-10 ${
                                        index < chart.bars.length / 2 ? 'left-0' : 'right-0'
                                    }`}
                                >
                                    {bar.label} · {formatUsd(bar.cents)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <span />
                    <div className="flex justify-between">
                        <span>{first?.label ?? ''}</span>
                        <span>{middle?.label ?? ''}</span>
                        <span>{last?.label ?? ''}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
