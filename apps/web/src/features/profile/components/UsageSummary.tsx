import React from 'react'
import { useNavigate } from 'react-router-dom'

import type { ChartLine } from '@/features/admin/components/AdminCharts'
import type { UsageDay, UsageHour, UsageTotals } from '@/features/billing/api/billing'

import {
    CHART_COLORS,
    ChartBox,
    DualAxisLineChart,
    compactNumber,
} from '@/features/admin/components/AdminCharts'
import { ListArt, listActionButtonClass } from '@/features/sessions/components/ListParts'
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

/** the lines of the empty chart: flat at zero, so the axes and dates still draw */
const emptyLines = (count: number): ChartLine[] => [
    {
        key: 'tokens',
        label: 'Tokens',
        color: CHART_COLORS.blue,
        values: Array.from({ length: count }, () => 0),
        axis: 'left',
    },
    {
        key: 'spent',
        label: 'Spent',
        color: CHART_COLORS.amber,
        values: Array.from({ length: count }, () => 0),
        axis: 'right',
    },
]

/**
 * Three numbers and a chart above the usage table (N5-B), in the style of the Analytics
 * chart on the admin page. The server sends all of it for the whole range (issue 638): the
 * totals, the sums for each day, and the sums for each hour when the range is one day.
 * Tokens are on the left axis, so runs on own keys show too, and spend is on the right.
 */
export const UsageSummary: React.FC<{
    totals: UsageTotals
    days: UsageDay[]
    hours?: UsageHour[]
    /** the range of the chart, as its title says it: "Last 30 days" */
    title: string
}> = ({ totals, days, hours, title }) => {
    const chart = React.useMemo(() => {
        const rows = hours
            ? hours.map((row) => ({ ...row, label: hourLabel(row.hour) }))
            : days.map((row) => ({ ...row, label: dayLabel(row.date) }))
        const ownKey = rows.map((row) => Math.min(row.ownKeyTokens ?? 0, row.totalTokens))
        const credits = rows.map((row, index) => row.totalTokens - (ownKey[index] ?? 0))
        const lines: ChartLine[] = []
        // a source with no tokens in the range has no line: a flat zero says nothing
        if (credits.some((value) => value > 0)) {
            lines.push({
                key: 'credits',
                label: 'Credits tokens',
                color: CHART_COLORS.blue,
                values: credits,
                axis: 'left',
            })
        }
        if (ownKey.some((value) => value > 0)) {
            lines.push({
                key: 'own-key',
                label: 'Your keys tokens',
                color: CHART_COLORS.green,
                values: ownKey,
                axis: 'left',
            })
        }
        lines.push({
            key: 'spent',
            label: 'Spent',
            color: CHART_COLORS.amber,
            values: rows.map((row) => row.costInCents),
            axis: 'right',
        })
        return { labels: rows.map((row) => row.label), lines }
    }, [days, hours])

    const navigate = useNavigate()
    const isEmpty = totals.totalTokens <= 0

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

            {chart.labels.length > 0 &&
                (isEmpty ? (
                    <ChartBox title={title}>
                        {/* nothing ran: the empty chart, dimmed, with a drawing and a way to start */}
                        <div className="relative">
                            <div aria-hidden="true" className="pointer-events-none opacity-30">
                                <DualAxisLineChart
                                    labels={chart.labels}
                                    lines={emptyLines(chart.labels.length)}
                                    formatLeft={(tokens) => formatTokenCount(tokens)}
                                    formatRight={(cents) => `$${compactNumber(cents / 100)}`}
                                    minLeft={1000}
                                    minRight={100}
                                    height={250}
                                />
                            </div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <div className="mb-3 h-[105px] w-[120px] text-[#8A8987]">
                                    <ListArt kind="usage" strokePx={2.2} widthPx={120} />
                                </div>
                                <span className="text-[14px] font-medium text-[#D6D5C9]">
                                    No usage in this period
                                </span>
                                <button
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className={`mt-3 bg-[#191919] ${listActionButtonClass}`}
                                >
                                    Start a session
                                </button>
                            </div>
                        </div>
                    </ChartBox>
                ) : (
                    <ChartBox title={title}>
                        <DualAxisLineChart
                            labels={chart.labels}
                            lines={chart.lines}
                            formatLeft={(tokens) => formatTokenCount(tokens)}
                            formatRight={(cents) => `$${compactNumber(cents / 100)}`}
                            minRight={100}
                            height={200}
                        />
                    </ChartBox>
                ))}
        </div>
    )
}
