import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { cn } from '@/shared/lib/utils'

// parts the Sessions and Pull requests pages share, so both lists look the same:
// search box, toolbar, row, status, time, empty, error and loading states.

/** one list row: no box, rounded hover, the same on both pages */
export const listRowClass =
    'rounded-lg px-2.5 py-2 transition-colors duration-200 hover:bg-[#191919] cursor-pointer outline-none focus-visible:bg-[#191919]'

export const ListSearchInput: React.FC<{
    value: string
    onChange: (value: string) => void
    placeholder: string
}> = ({ value, onChange, placeholder }) => (
    <div className="relative w-full md:max-w-[320px]">
        <Icons.Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B7A79]" />
        <input
            type="text"
            placeholder={placeholder}
            aria-label={placeholder.replace(/\.+$/, '')}
            value={value}
            // the server takes searches of 200 characters at most
            maxLength={200}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-[#282828] bg-[#202020] py-1.5 pl-9 pr-4 text-[13px] text-[#949494] transition-colors placeholder:text-[#949494] hover:bg-[#282828] focus:border-[#7B7A79] focus:bg-[#202020] focus:outline-none"
        />
    </div>
)

/** search first; filters and the rest follow it on desktop and get their own line on phones */
export const ListToolbar: React.FC<{ search: React.ReactNode; children: React.ReactNode }> = ({
    search,
    children,
}) => (
    <div className="relative z-10 mb-4 flex w-full flex-col gap-2 md:flex-row md:items-center">
        {search}
        <div className="flex items-center gap-2 md:contents">{children}</div>
    </div>
)

const switchSideClass = (active: boolean) =>
    cn(
        'flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md transition-all cursor-pointer',
        active ? 'bg-[#282828] text-white shadow-sm' : 'text-[#8F8E8D] hover:text-[#D6D5C9]'
    )

/** the All | Running and All | Open switch next to search: a green dot, a word and a count */
export const ListSwitch: React.FC<{
    /** the word of the second side: "Running", "Open" */
    onLabel: string
    isOn: boolean
    onChange: (isOn: boolean) => void
    count?: number
}> = ({ onLabel, isOn, onChange, count }) => (
    <div className="flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-lg border border-[#282828] shrink-0">
        <button
            type="button"
            aria-pressed={!isOn}
            onClick={() => onChange(false)}
            className={switchSideClass(!isOn)}
        >
            All
        </button>
        <button
            type="button"
            aria-pressed={isOn}
            onClick={() => onChange(true)}
            className={switchSideClass(isOn)}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{onLabel}</span>
            {count !== undefined && count > 0 && (
                <span
                    className={cn(
                        'text-[11.5px] tabular-nums',
                        isOn ? 'text-[#949494]' : 'text-[#6B6A69]'
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    </div>
)

/** running and starting sessions: a dot and a word, no pill */
export const RunStatus: React.FC<{ vmStatus?: string | null; className?: string }> = ({
    vmStatus,
    className,
}) => {
    if (vmStatus !== 'RUNNING' && vmStatus !== 'PROVISIONING') return null
    const isRunning = vmStatus === 'RUNNING'
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 shrink-0 text-[12px] text-[#949494] whitespace-nowrap',
                className
            )}
        >
            <span
                className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isRunning ? 'bg-emerald-400' : 'bg-amber-400'
                )}
            />
            {isRunning ? 'Running' : 'Starting'}
        </span>
    )
}

const fullDate = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

/** "4m ago", with the full date on hover */
export const RelativeTime: React.FC<{ iso: string; label?: string }> = ({ iso, label }) => {
    const full = fullDate(iso)
    const text = <span className="whitespace-nowrap">{formatRelativeTime(iso)}</span>
    if (!full) return text
    return (
        <Tooltip position="top" content={label ? `${label} ${full}` : full}>
            {text}
        </Tooltip>
    )
}

/** grey dot between parts of a meta line */
export const MetaDot: React.FC = () => <span className="text-[#4A4A4A]">·</span>

// the drawings of the empty states: one hand-drawn line drawing for each case (review picks
// D1, then NS3, NP1, GH4, NR2, CL1 and size SZ2). the lines are plain paths in a 128 x 112
// box; a small displacement filter gives the hand-drawn look. no decoration marks.

export type ListArtKind =
    | 'sessions'
    | 'pullRequests'
    | 'connect'
    | 'noResults'
    | 'loadError'
    | 'inbox'

const circlePath = (cx: number, cy: number, r: number) =>
    `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

const roundRectPath = (x: number, y: number, w: number, h: number, r: number) =>
    `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`

interface ListArtShapes {
    /** drawn as strokes */
    lines: string[]
    /** small filled shapes, like the buttons of a window */
    dots?: string[]
    /** lines that cut through what is behind them: a gap in the page colour, then the line */
    cuts?: string[]
}

const LIST_ART: Record<ListArtKind, ListArtShapes> = {
    // no sessions yet: two chat bubbles, a message and a reply being typed
    sessions: {
        lines: [
            'M20 12H72a10 10 0 0 1 10 10V40a10 10 0 0 1-10 10H38L22 64l2-14H20A10 10 0 0 1 10 40V22A10 10 0 0 1 20 12Z',
            'M24 26h44',
            'M24 37h26',
            'M58 56h50a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10h-2l2 12-16-12H58a10 10 0 0 1-10-10V66a10 10 0 0 1 10-10Z',
        ],
        dots: [circlePath(68, 76, 2.4), circlePath(83, 76, 2.4), circlePath(98, 76, 2.4)],
    },
    // no pull requests yet: the pull request mark
    pullRequests: {
        lines: [
            'M34 36V76',
            'M94 38v12q0 16-16 16H54',
            'M64 56l-10 10 10 10',
            circlePath(34, 24, 11),
            circlePath(34, 88, 11),
            circlePath(94, 26, 11),
        ],
    },
    // GitHub is not connected: a loose cable with its plug
    connect: {
        lines: ['M8 40q4 44 28 30t26 0', roundRectPath(62, 54, 34, 32, 8), 'M96 62h14M96 78h14'],
    },
    // search or a filter gives nothing: a magnifier over a list
    noResults: {
        lines: [
            'M10 24h70',
            'M10 44h44',
            'M10 64h34',
            'M10 84h44',
            circlePath(84, 58, 26),
            'M103 77l19 19',
        ],
    },
    // an empty inbox (D1): an inbox tray with nothing in it
    inbox: {
        lines: [
            'M14 62L32 22H96L114 62V92a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10Z',
            'M14 62H44q3 16 20 16t20-16H114',
        ],
    },
    // the list could not load: a cloud with a line through it
    loadError: {
        lines: ['M36 88a21 21 0 0 1-2-42a28 28 0 0 1 54-6a23 23 0 0 1 4 48Z'],
        cuts: ['M22 102L106 12'],
    },
}

/** the drawing is shown 160 px wide. the line stays 2.4 px on screen at that size */
const LIST_ART_STROKE = (2.4 * 128) / 160

/**
 * strokePx and widthPx: a smaller drawing (the inbox) keeps a line that reads at its size.
 * Left out, the line is 2.4 px at 160 px wide, as on the list pages.
 */
export const ListArt: React.FC<{ kind: ListArtKind; strokePx?: number; widthPx?: number }> = ({
    kind,
    strokePx,
    widthPx,
}) => {
    // useId can hold characters that do not work inside url(#...)
    const filterId = `list-art-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
    const art = LIST_ART[kind]
    const stroke = strokePx && widthPx ? (strokePx * 128) / widthPx : LIST_ART_STROKE
    return (
        <svg
            viewBox="0 0 128 112"
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-full w-full"
            aria-hidden="true"
        >
            <defs>
                <filter id={filterId} x="-8%" y="-8%" width="116%" height="116%">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.045"
                        numOctaves="2"
                        seed="7"
                        result="noise"
                    />
                    <feDisplacementMap
                        in="SourceGraphic"
                        in2="noise"
                        scale="3.4"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                </filter>
            </defs>
            <g filter={`url(#${filterId})`}>
                {art.lines.map((d) => (
                    <path key={d} d={d} />
                ))}
                {art.dots?.map((d) => (
                    <path key={d} d={d} fill="currentColor" stroke="none" />
                ))}
                {art.cuts?.map((d) => (
                    <React.Fragment key={d}>
                        <path
                            d={d}
                            stroke="var(--color-background, #141414)"
                            strokeWidth={stroke * 4.5}
                        />
                        <path d={d} />
                    </React.Fragment>
                ))}
            </g>
        </svg>
    )
}

/** empty list, no results, not connected: the drawing, one title, then an optional button */
export const ListEmptyState: React.FC<{
    title: string
    art?: ListArtKind
    children?: React.ReactNode
}> = ({ title, art = 'sessions', children }) => (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 h-[140px] w-40 max-w-full text-[#8A8987]">
            <ListArt kind={art} />
        </div>
        <h2 className="text-[17px] font-medium text-[#D6D5C9]">{title}</h2>
        {children && <div className="mt-4 flex flex-col items-center gap-3">{children}</div>}
    </div>
)

/** the small outline button under an empty or error state */
export const listActionButtonClass =
    'rounded-lg border border-[#383736] px-3 py-1 text-[12.5px] font-medium text-[#D6D5C9] transition-colors hover:bg-[#242323] cursor-pointer'

/** the list could not load: the same box as the empty list, with Try again */
export const ListErrorState: React.FC<{
    message: string
    onRetry: () => void
}> = ({ message, onRetry }) => (
    <ListEmptyState title={message} art="loadError">
        <button type="button" onClick={onRetry} className={listActionButtonClass}>
            Try again
        </button>
    </ListEmptyState>
)

const SKELETON_WIDTHS = [48, 62, 38, 55, 44, 58, 50]

/**
 * loading rows in the same two-line shape as the real rows. the padding, the gap and the
 * two line boxes (21px for the 14px title, 18px for the 12px meta line) match listRowClass
 * rows, so each loading row is as tall as a real one (57px) and nothing moves when the
 * rows arrive
 */
export const ListRowsSkeleton: React.FC<{ rows?: number }> = ({ rows = 7 }) => (
    <div className="flex flex-col gap-1" aria-busy="true">
        {SKELETON_WIDTHS.slice(0, rows).map((width, index) => (
            <div
                key={index}
                data-skeleton-row
                className="flex items-center gap-3 rounded-lg px-2.5 py-2"
            >
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <div className="flex h-[21px] items-center">
                        <Skeleton
                            className="h-3.5 bg-white/[0.04] rounded"
                            style={{ width: `${width}%` }}
                        />
                    </div>
                    <div className="flex h-[18px] items-center">
                        <Skeleton
                            className="h-2.5 bg-white/[0.02] rounded"
                            style={{ width: `${Math.min(width + 10, 70)}%` }}
                        />
                    </div>
                </div>
                <Skeleton className="h-4 w-12 bg-white/[0.03] rounded-md shrink-0" />
            </div>
        ))}
    </div>
)
