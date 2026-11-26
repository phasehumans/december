import React from 'react'

import { cn } from '@/shared/lib/utils'

// small charts for the admin panel, drawn as plain SVG (no chart library in the bundle)

export const CHART_COLORS = {
    blue: '#87B2F4',
    green: '#7FD49A',
    amber: '#F2C07B',
    red: '#F28B82',
    grey: '#6B6A68',
    violet: '#B9A6F2',
} as const

export const compactNumber = (value: number) =>
    Math.abs(value) >= 1000
        ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
        : `${Math.round(value * 10) / 10}`

/** "2026-11-26" as "26 Nov" */
export const dayLabel = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export const StatusDot: React.FC<{ status: 'ok' | 'warn' | 'down'; className?: string }> = ({
    status,
    className,
}) => (
    <span
        aria-label={status}
        className={cn(
            'inline-block w-2 h-2 rounded-full shrink-0',
            status === 'ok' && 'bg-[#7FD49A]',
            status === 'warn' && 'bg-[#F2C07B]',
            status === 'down' && 'bg-[#F28B82]',
            className
        )}
    />
)

/** a number with a label, and an optional small chart under it */
export const StatTile: React.FC<{
    label: string
    value: React.ReactNode
    hint?: React.ReactNode
    children?: React.ReactNode
    onClick?: () => void
}> = ({ label, value, hint, children, onClick }) => {
    const Tag = onClick ? 'button' : 'div'
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn(
                'bg-[#191919] border border-[#242323] rounded-xl px-3.5 py-3 flex flex-col gap-1 min-w-0 text-left',
                onClick && 'hover:bg-[#1E1E1E] cursor-pointer'
            )}
        >
            <span className="text-[12px] text-[#7B7A79]">{label}</span>
            <span className="text-[20px] leading-tight text-[#EDEDED] tabular-nums truncate">
                {value}
            </span>
            {hint && <span className="text-[11.5px] text-[#7B7A79] truncate">{hint}</span>}
            {children}
        </Tag>
    )
}

export const TileGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{children}</div>
)

export const ChartBox: React.FC<{
    title: string
    action?: React.ReactNode
    legend?: Array<{ label: string; color: string }>
    className?: string
    children: React.ReactNode
}> = ({ title, action, legend, className, children }) => (
    <div
        className={cn(
            'bg-[#191919] border border-[#242323] rounded-xl p-3.5 flex flex-col gap-2.5 min-w-0',
            className
        )}
    >
        <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[13px] text-[#D6D5C9]">{title}</span>
            {action}
        </div>
        {legend && legend.length > 1 && (
            <div className="flex items-center gap-3 flex-wrap">
                {legend.map((item) => (
                    <span
                        key={item.label}
                        className="flex items-center gap-1.5 text-[11.5px] text-[#9A9998]"
                    >
                        <span
                            className="w-2 h-2 rounded-sm"
                            style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                    </span>
                ))}
            </div>
        )}
        {children}
    </div>
)

export const NoData: React.FC<{ text?: string }> = ({ text = 'No data yet' }) => (
    <div className="h-[80px] flex items-center justify-center text-[12.5px] text-[#7B7A79]">
        {text}
    </div>
)

/** the real width of a box, so a chart draws its 10px text at 10px on any screen */
const useMeasuredWidth = (fallback = 600) => {
    // B8: a callback ref, so a chart that first shows "No data yet" (no box drawn) starts
    // measuring as soon as its box appears
    const [node, setNode] = React.useState<HTMLDivElement | null>(null)
    const [width, setWidth] = React.useState(fallback)
    React.useEffect(() => {
        if (!node || typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(([entry]) => {
            const next = Math.round(entry?.contentRect.width ?? 0)
            if (next > 0) setWidth(next)
        })
        observer.observe(node)
        return () => observer.disconnect()
    }, [node])
    return { ref: setNode, width }
}

interface BarSeries {
    label: string
    color: string
    values: number[]
}

/** stacked bars, one for each label, with a hover title on each bar */
export const BarChart: React.FC<{
    labels: string[]
    series: BarSeries[]
    format?: (value: number) => string
    height?: number
}> = ({ labels, series, format = compactNumber, height = 140 }) => {
    const { ref, width } = useMeasuredWidth()
    const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
    const max = Math.max(...totals, 0)
    if (max <= 0) return <NoData />

    const top = 14
    const bottom = 18
    const plot = height - top - bottom
    const slot = width / labels.length
    const barWidth = Math.max(2, Math.min(28, slot * 0.7))
    // about one label per 80px, whatever the window
    const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(width / 80))))

    return (
        <div ref={ref} className="w-full">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto"
                role="img"
                aria-label={`${series.map((s) => s.label).join(', ')} by ${labels.length} periods`}
            >
                <line x1={0} x2={width} y1={top} y2={top} stroke="#262625" strokeDasharray="3 4" />
                <text x={0} y={top - 4} fill="#7B7A79" fontSize={10}>
                    {format(max)}
                </text>
                <line
                    x1={0}
                    x2={width}
                    y1={top + plot}
                    y2={top + plot}
                    stroke="#2A2928"
                    strokeWidth={1}
                />
                {labels.map((label, i) => {
                    let y = top + plot
                    const x = i * slot + (slot - barWidth) / 2
                    return (
                        <g key={label}>
                            <title>
                                {label}:{' '}
                                {series
                                    .map((s) => `${s.label} ${format(s.values[i] ?? 0)}`)
                                    .join(', ')}
                            </title>
                            <rect
                                x={i * slot}
                                y={top}
                                width={slot}
                                height={plot}
                                fill="transparent"
                            />
                            {series.map((s) => {
                                const value = s.values[i] ?? 0
                                if (value <= 0) return null
                                const h = Math.max(1, (value / max) * plot)
                                y -= h
                                return (
                                    <rect
                                        key={s.label}
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={h}
                                        rx={1.5}
                                        fill={s.color}
                                    />
                                )
                            })}
                            {
                                // counted back from the newest, so it always has a label and none run together
                                (labels.length - 1 - i) % every === 0 && (
                                    <text
                                        x={
                                            i === 0
                                                ? 0
                                                : i === labels.length - 1
                                                  ? width
                                                  : i * slot + slot / 2
                                        }
                                        y={height - 4}
                                        fill="#7B7A79"
                                        fontSize={10}
                                        textAnchor={
                                            i === 0
                                                ? 'start'
                                                : i === labels.length - 1
                                                  ? 'end'
                                                  : 'middle'
                                        }
                                    >
                                        {label}
                                    </text>
                                )
                            }
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

export interface ChartLine {
    key: string
    label: string
    color: string
    values: number[]
    /** left: counts, right: dollars (drawn dashed so the two are easy to tell apart) */
    axis: 'left' | 'right'
}

/** 1, 2 or 5 times a power of ten, at or above the value: an axis top that reads well */
const niceMax = (value: number) => {
    if (value <= 0) return 1
    const power = 10 ** Math.floor(Math.log10(value))
    const step = [1, 2, 5, 10].find((m) => m * power >= value) ?? 10
    return step * power
}

/**
 * O2: every line in one chart, counts on the left axis and dollars on the right. Hover (or
 * tap) a day to read all its values; the legend turns lines on and off.
 */
export const DualAxisLineChart: React.FC<{
    labels: string[]
    lines: ChartLine[]
    formatLeft?: (value: number) => string
    formatRight?: (value: number) => string
    height?: number
    /** the heading of the hover box for each point, when it should differ from the label */
    titles?: string[]
    /** the smallest top of each axis, so an axis with no data still reads well ($1, not $0) */
    minLeft?: number
    minRight?: number
}> = ({
    labels,
    lines,
    formatLeft = compactNumber,
    formatRight = compactNumber,
    height = 240,
    titles,
    minLeft = 1,
    minRight = 1,
}) => {
    const [hidden, setHidden] = React.useState<Set<string>>(new Set())
    const [hover, setHover] = React.useState<number | null>(null)
    // drawn at its real width, so the text stays 10px on a phone
    const { ref: boxRef, width: measured } = useMeasuredWidth(640)

    const shown = lines.filter((line) => !hidden.has(line.key))
    const axisMax = (axis: ChartLine['axis']) =>
        niceMax(
            Math.max(
                axis === 'left' ? minLeft : minRight,
                ...shown.filter((l) => l.axis === axis).flatMap((l) => l.values)
            )
        )
    const leftMax = axisMax('left')
    const rightMax = axisMax('right')
    const hasLeft = shown.some((l) => l.axis === 'left')
    const hasRight = shown.some((l) => l.axis === 'right')

    const width = measured
    const left = 34
    const right = 44
    const top = 10
    const bottom = 20
    const plotW = width - left - right
    const plotH = height - top - bottom
    const n = labels.length
    const xAt = (i: number) => left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    const yAt = (value: number, axis: ChartLine['axis']) =>
        top + plotH - (value / (axis === 'left' ? leftMax : rightMax)) * plotH
    // about one date label per 90px
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 90))))
    const ticks = [0, 0.5, 1]

    const toggle = (key: string) =>
        setHidden((current) => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })

    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1 flex-wrap">
                {lines.map((line) => {
                    const on = !hidden.has(line.key)
                    return (
                        <button
                            key={line.key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(line.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] cursor-pointer hover:bg-[#1F1F1F]',
                                on ? 'text-[#D6D5C9]' : 'text-[#5C5C5C]'
                            )}
                        >
                            <svg width="14" height="6" aria-hidden="true">
                                <line
                                    x1={0}
                                    x2={14}
                                    y1={3}
                                    y2={3}
                                    stroke={on ? line.color : '#4A4948'}
                                    strokeWidth={2}
                                    strokeDasharray={line.axis === 'right' ? '3 2' : undefined}
                                />
                            </svg>
                            {line.label}
                        </button>
                    )
                })}
            </div>

            <div ref={boxRef} className="relative" onMouseLeave={() => setHover(null)}>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-auto"
                    role="img"
                    aria-label={`${shown.map((l) => l.label).join(', ')} over ${n} days`}
                >
                    {ticks.map((t) => {
                        const y = top + plotH - t * plotH
                        return (
                            <g key={t}>
                                <line
                                    x1={left}
                                    x2={width - right}
                                    y1={y}
                                    y2={y}
                                    stroke={t === 0 ? '#2A2928' : '#232322'}
                                    strokeDasharray={t === 0 ? undefined : '3 4'}
                                />
                                {hasLeft && (
                                    <text
                                        x={left - 6}
                                        y={y + 3}
                                        fill="#7B7A79"
                                        fontSize={10}
                                        textAnchor="end"
                                    >
                                        {formatLeft(leftMax * t)}
                                    </text>
                                )}
                                {hasRight && (
                                    <text
                                        x={width - right + 6}
                                        y={y + 3}
                                        fill="#7B7A79"
                                        fontSize={10}
                                    >
                                        {formatRight(rightMax * t)}
                                    </text>
                                )}
                            </g>
                        )
                    })}

                    {labels.map((label, i) =>
                        // counted back from the newest day, so it always has a label and
                        // two labels never run into each other
                        (n - 1 - i) % every === 0 ? (
                            <text
                                key={label + i}
                                x={xAt(i)}
                                y={height - 5}
                                fill="#7B7A79"
                                fontSize={10}
                                textAnchor="middle"
                            >
                                {label}
                            </text>
                        ) : null
                    )}

                    {hover !== null && (
                        <line
                            x1={xAt(hover)}
                            x2={xAt(hover)}
                            y1={top}
                            y2={top + plotH}
                            stroke="#3A3938"
                        />
                    )}

                    {shown.map((line) => (
                        <g key={line.key}>
                            <polyline
                                fill="none"
                                stroke={line.color}
                                strokeWidth={1.75}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                strokeDasharray={line.axis === 'right' ? '5 4' : undefined}
                                points={line.values
                                    .map((v, i) => `${xAt(i)},${yAt(v, line.axis)}`)
                                    .join(' ')}
                            />
                            {hover !== null && (
                                <circle
                                    cx={xAt(hover)}
                                    cy={yAt(line.values[hover] ?? 0, line.axis)}
                                    r={3}
                                    fill={line.color}
                                />
                            )}
                        </g>
                    ))}

                    {labels.map((label, i) => (
                        <rect
                            key={`hit-${label}-${i}`}
                            x={xAt(i) - plotW / Math.max(1, n - 1) / 2}
                            y={top}
                            width={plotW / Math.max(1, n - 1)}
                            height={plotH}
                            fill="transparent"
                            onMouseEnter={() => setHover(i)}
                            onClick={() => setHover(i)}
                        />
                    ))}
                </svg>

                {hover !== null && shown.length > 0 && (
                    <div
                        role="status"
                        className="absolute top-1 pointer-events-none bg-[#1F1F1F] border border-[#2B2A27] rounded-lg px-2.5 py-2 flex flex-col gap-1 text-[12px] shadow-lg min-w-[150px]"
                        style={
                            xAt(hover) / width > 0.6
                                ? { right: `${100 - (xAt(hover) / width) * 100 + 2}%` }
                                : { left: `${(xAt(hover) / width) * 100 + 2}%` }
                        }
                    >
                        <span className="text-[#9A9998]">{titles?.[hover] ?? labels[hover]}</span>
                        {shown.map((line) => (
                            <span
                                key={line.key}
                                className="flex items-center justify-between gap-3"
                            >
                                <span className="flex items-center gap-1.5 text-[#B5B4AE]">
                                    <span
                                        className="w-2 h-2 rounded-sm"
                                        style={{ backgroundColor: line.color }}
                                    />
                                    {line.label}
                                </span>
                                <span className="text-[#EDEDED] tabular-nums">
                                    {(line.axis === 'left' ? formatLeft : formatRight)(
                                        line.values[hover] ?? 0
                                    )}
                                </span>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

/** each step as a bar, with its share of the first step and of the step before */
export const Funnel: React.FC<{ steps: Array<{ label: string; value: number }> }> = ({ steps }) => {
    const first = steps[0]?.value ?? 0
    if (first === 0) return <NoData text="No signups in this window" />
    return (
        <div className="flex flex-col gap-2.5">
            {steps.map((step, i) => {
                const share = step.value / first
                const previous = i > 0 ? (steps[i - 1]?.value ?? 0) : 0
                return (
                    <div key={step.label} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                            <span className="text-[#D6D5C9] min-w-0">{step.label}</span>
                            <span className="text-[#D6D5C9] tabular-nums shrink-0">
                                {step.value}{' '}
                                <span className="text-[#7B7A79]">
                                    {Math.round(share * 100)}%
                                    {i > 0 && previous > 0 && (
                                        // the share of the step before, only where it fits
                                        <span className="hidden sm:inline">
                                            {` · ${Math.round((step.value / previous) * 100)}% of the step before`}
                                        </span>
                                    )}
                                </span>
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#222221] overflow-hidden">
                            <div
                                className="h-full rounded-full bg-[#87B2F4]"
                                style={{
                                    width: `${Math.max(step.value > 0 ? 1 : 0, share * 100)}%`,
                                }}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/** a grid of cells shaded by value (cohorts, hour of day) */
export const HeatGrid: React.FC<{
    rows: Array<{ label: string; cells: Array<number | null>; titles?: string[] }>
    columns: string[]
    color?: string
    format?: (value: number) => string
}> = ({ rows, columns, color = '135, 178, 244', format = (v) => String(v) }) => {
    const max = Math.max(
        1,
        ...rows.flatMap((row) => row.cells.filter((v): v is number => v !== null))
    )
    return (
        <div className="overflow-x-auto">
            <table className="border-separate border-spacing-[2px] text-[11px] tabular-nums">
                <thead>
                    <tr>
                        <th />
                        {columns.map((column) => (
                            <th key={column} className="font-normal text-[#7B7A79] px-0.5">
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.label}>
                            <th className="font-normal text-[#9A9998] text-left pr-2 whitespace-nowrap">
                                {row.label}
                            </th>
                            {row.cells.map((value, i) => (
                                <td
                                    key={i}
                                    title={row.titles?.[i]}
                                    className="min-w-[26px] h-[22px] rounded-[3px] text-center"
                                    style={{
                                        backgroundColor:
                                            value === null
                                                ? 'transparent'
                                                : value === 0
                                                  ? '#1F1F1E'
                                                  : `rgba(${color}, ${0.18 + 0.82 * (value / max)})`,
                                        color:
                                            value !== null && value / max > 0.55
                                                ? '#100E12'
                                                : '#B5B4AE',
                                    }}
                                >
                                    {value === null || value === 0 ? '' : format(value)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
