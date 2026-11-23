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

const Cube: React.FC = () => (
    <svg viewBox="0 0 128 112" fill="none" className="h-full w-full" aria-hidden="true">
        <path
            d="M28 42.5 64 22l36 20.5v43L64 106 28 85.5v-43Z"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
        />
        <path
            d="M28 42.5 64 63l36-20.5M64 63v43"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

/** empty list and no results: the cube and one title */
export const ListEmptyState: React.FC<{ title: string; children?: React.ReactNode }> = ({
    title,
    children,
}) => (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 h-24 w-28 text-[#8A8987]">
            <Cube />
        </div>
        <h2 className="text-[17px] font-medium text-[#D6D5C9]">{title}</h2>
        {children && <div className="mt-4 flex flex-col items-center gap-3">{children}</div>}
    </div>
)

/** the list could not load: say so where the rows would be, with Try again */
export const ListErrorState: React.FC<{ message: string; onRetry: () => void }> = ({
    message,
    onRetry,
}) => (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-12 text-center text-[13px] text-[#7B7A79]">
        <span>{message}</span>
        <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-[#383736] px-3 py-1 text-[12.5px] font-medium text-[#D6D5C9] transition-colors hover:bg-[#242323] cursor-pointer"
        >
            Try again
        </button>
    </div>
)

const SKELETON_WIDTHS = [48, 62, 38, 55, 44, 58, 50]

/** loading rows in the same two-line shape as the real rows */
export const ListRowsSkeleton: React.FC<{ rows?: number }> = ({ rows = 7 }) => (
    <div className="flex flex-col gap-1" aria-busy="true">
        {SKELETON_WIDTHS.slice(0, rows).map((width, index) => (
            <div
                key={index}
                data-skeleton-row
                className="flex items-center gap-3 rounded-lg px-2.5 py-2.5"
            >
                <div className="flex flex-1 flex-col gap-2 min-w-0">
                    <Skeleton
                        className="h-3.5 bg-white/[0.04] rounded"
                        style={{ width: `${width}%` }}
                    />
                    <Skeleton
                        className="h-2.5 bg-white/[0.02] rounded"
                        style={{ width: `${Math.min(width + 10, 70)}%` }}
                    />
                </div>
                <Skeleton className="h-4 w-12 bg-white/[0.03] rounded-md shrink-0" />
            </div>
        ))}
    </div>
)
