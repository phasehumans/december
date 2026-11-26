import { useMutation, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { sectionBoxClass, sectionTitleClass } from '@/features/profile/components/settingsStyles'
import { useBackToClose } from '@/shared/lib/useBackToClose'
import { cn } from '@/shared/lib/utils'

// small parts shared by the admin sections, in the settings page styles

export const money = (cents: number) =>
    `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`

export const shortDate = (iso?: string | null) =>
    iso
        ? new Date(iso).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '-'

export const adminInputClass =
    'bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3 py-1.5 text-[13px] text-white focus:outline-none placeholder:text-[#4A4948]'

export const AdminButton: React.FC<{
    onClick?: () => void
    disabled?: boolean
    tone?: 'primary' | 'outline' | 'danger'
    type?: 'button' | 'submit'
    children: React.ReactNode
}> = ({ onClick, disabled, tone = 'outline', type = 'button', children }) => (
    <button
        type={type === 'submit' ? 'submit' : 'button'}
        onClick={onClick}
        disabled={disabled}
        className={cn(
            'shrink-0 px-3 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default',
            tone === 'primary' && 'bg-[#87B2F4] text-[#100E12] hover:bg-[#A3C7FF] font-medium',
            tone === 'outline' && 'border border-[#383736] text-[#D6D5C9] hover:bg-[#242323]',
            tone === 'danger' && 'border border-[#5A2A2A] text-[#F28B82] hover:bg-[#2A1C1C]'
        )}
    >
        {children}
    </button>
)

export const AdminSection: React.FC<{
    title: string
    action?: React.ReactNode
    children: React.ReactNode
}> = ({ title, action, children }) => (
    <section className="flex flex-col gap-2.5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5 min-w-0">
                <h2 className={sectionTitleClass}>{title}</h2>
            </div>
            {action}
        </div>
        {children}
    </section>
)

export const AdminBox: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => <div className={cn(sectionBoxClass, className)}>{children}</div>

/** a list of rows in one box; each row wraps on phones */
export const AdminList: React.FC<{ empty: string; children: React.ReactNode[] }> = ({
    empty,
    children,
}) => (
    <div className="bg-[#191919] border border-[#242323] rounded-xl overflow-hidden flex flex-col divide-y divide-[#242323]">
        {children.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-[#7B7A79]">{empty}</div>
        ) : (
            children
        )}
    </div>
)

export const AdminRow: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => (
    <div
        className={cn(
            'px-4 py-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2',
            className
        )}
    >
        {children}
    </div>
)

export const Muted: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => <span className={cn('text-[12.5px] text-[#7B7A79]', className)}>{children}</span>

export const Tag: React.FC<{ tone?: 'warn' | 'ok' | 'plain'; children: React.ReactNode }> = ({
    tone = 'plain',
    children,
}) => (
    <span
        className={cn(
            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11.5px]',
            tone === 'warn' && 'bg-[#3A2A14] text-[#F2C07B]',
            tone === 'ok' && 'bg-[#16301F] text-[#7FD49A]',
            tone === 'plain' && 'bg-[#262625] text-[#9A9998]'
        )}
    >
        {children}
    </span>
)

/** A popup over the page: closes on Esc and on a click outside the card. */
export const AdminDialog: React.FC<{
    label: string
    onClose: () => void
    className?: string
    children: React.ReactNode
}> = ({ label, onClose, className, children }) => {
    // Back on a phone closes the popup instead of leaving the admin page
    useBackToClose({ isOpen: true, onClose })
    React.useEffect(() => {
        const close = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', close)
        return () => document.removeEventListener('keydown', close)
    }, [onClose])

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4"
            onClick={onClose}
        >
            {/* a bottom sheet on a phone, a centered card on a computer */}
            <div
                className={cn(
                    'bg-[#1A1A1A] border border-[#2B2A27] w-full overflow-y-auto',
                    // it still scrolls (wheel, touch, keys); only the wide bar is hidden
                    '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    'rounded-t-2xl border-b-0 max-h-[92dvh] pb-[env(safe-area-inset-bottom)]',
                    'md:rounded-xl md:border-b md:max-h-[88vh] md:pb-0',
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    )
}

export const ErrorLine: React.FC<{ error: unknown }> = ({ error }) =>
    error ? (
        <p role="alert" className="text-[12.5px] text-red-400">
            {(error as Error)?.message || 'Something went wrong'}
        </p>
    ) : null

/** an admin action that refetches the given lists when it is done */
export function useAdminAction<TArgs extends unknown[]>(
    run: (...args: TArgs) => Promise<unknown>,
    invalidate: string[][]
) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (args: TArgs) => run(...args),
        onSuccess: async () => {
            await Promise.all(
                invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
            )
        },
    })
}

/** U4: grey shapes in place of a tab's content while it loads */
export const AdminSkeleton: React.FC<{ rows?: number; tiles?: boolean }> = ({
    rows = 4,
    tiles = false,
}) => (
    <div className="flex flex-col gap-3 animate-pulse" aria-label="Loading" role="status">
        {tiles && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                    <div
                        key={i}
                        className="h-[78px] rounded-xl bg-[#1C1C1C] border border-[#242323]"
                    />
                ))}
            </div>
        )}
        <div className="rounded-xl bg-[#191919] border border-[#242323] divide-y divide-[#242323]">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="px-4 py-3.5 flex items-center justify-between gap-4">
                    <div className="h-3 w-1/3 rounded bg-[#262625]" />
                    <div className="h-3 w-16 rounded bg-[#262625]" />
                </div>
            ))}
        </div>
    </div>
)

const secondsAgo = (ms: number) => {
    const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
    return seconds < 60 ? `${seconds} s ago` : `${Math.round(seconds / 60)} min ago`
}

/** U5: "Updated 20 s ago" and a Refresh button that skips the server's short cache */
export const RefreshLine: React.FC<{
    updatedAt: number
    isFetching: boolean
    onRefresh: () => void
    children?: React.ReactNode
}> = ({ updatedAt, isFetching, onRefresh, children }) => {
    // re-render every 5 seconds so "20 s ago" stays true
    const [, setTick] = React.useState(0)
    React.useEffect(() => {
        const timer = setInterval(() => setTick((n) => n + 1), 5000)
        return () => clearInterval(timer)
    }, [])
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {children}
            <Muted>{updatedAt > 0 ? `Updated ${secondsAgo(updatedAt)}` : 'Loading'}</Muted>
            <button
                type="button"
                onClick={onRefresh}
                disabled={isFetching}
                className="text-[12.5px] text-[#D6D5C9] hover:text-white cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
                {isFetching ? 'Refreshing' : 'Refresh'}
            </button>
        </div>
    )
}
