import { useQuery } from '@tanstack/react-query'
import { Inbox, Menu } from 'lucide-react'
import React from 'react'

import { menuButtonBadge } from '../lib/mobileBadge'

import { useAppStore } from '@/app/store'
import { notificationAPI } from '@/features/notification/api/notification'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import { cn } from '@/shared/lib/utils'

// the one mobile top bar (phones only): menu on the left, title in the middle, one action
// on the right. every mobile screen renders it with its own title and right slot.

const useMobileBadgeData = () => {
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const { data: unreadData } = useQuery({
        queryKey: ['notifications-unread-count'],
        queryFn: notificationAPI.getUnreadCount,
        enabled: isAuthenticated,
        refetchInterval: 30 * 1000,
    })
    const { data: sessionsData } = useSessions()
    const running = React.useMemo(
        () =>
            (sessionsData?.sessions || []).some(
                (s) => s.vmStatus === 'RUNNING' || s.vmStatus === 'PROVISIONING'
            ),
        [sessionsData?.sessions]
    )
    return { unread: (unreadData?.count ?? 0) > 0, running }
}

const iconButton =
    'relative w-[34px] h-[34px] flex items-center justify-center rounded-[10px] text-[#8F8E8D] active:bg-[#252525] transition-colors cursor-pointer outline-none shrink-0'

const Dot: React.FC<{ tone: 'unread' | 'running' }> = ({ tone }) => (
    <span
        className={cn(
            'absolute top-[6px] right-[6px] w-[7px] h-[7px] rounded-full border-[1.5px] border-[#141414]',
            tone === 'unread' ? 'bg-[#87B2F4]' : 'bg-emerald-400'
        )}
    />
)

export const MobileMenuButton: React.FC<{ hasInboxButton?: boolean }> = ({
    hasInboxButton = false,
}) => {
    const openMobileSheet = useAppStore((s) => s.openMobileSheet)
    const { unread, running } = useMobileBadgeData()
    const badge = menuButtonBadge({ hasInboxButton, unread, running })
    return (
        <button
            type="button"
            onClick={() => openMobileSheet('menu')}
            aria-label="Open menu"
            className={iconButton}
        >
            <Menu className="w-[18px] h-[18px]" strokeWidth={1.8} />
            {badge && <Dot tone={badge} />}
        </button>
    )
}

export const MobileInboxButton: React.FC = () => {
    const openMobileSheet = useAppStore((s) => s.openMobileSheet)
    const { unread } = useMobileBadgeData()
    return (
        <button
            type="button"
            onClick={() => openMobileSheet('inbox')}
            aria-label="Inbox"
            className={iconButton}
        >
            <Inbox className="w-[18px] h-[18px]" strokeWidth={1.8} />
            {unread && <Dot tone="unread" />}
        </button>
    )
}

export const MobileIconButton: React.FC<{
    onClick: () => void
    label: string
    filled?: boolean
    children: React.ReactNode
}> = ({ onClick, label, filled, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(iconButton, filled && 'bg-[#232323] text-[#D6D5D4]')}
    >
        {children}
    </button>
)

export const MobileBackButton: React.FC<{ label: string; onClick: () => void }> = ({
    label,
    onClick,
}) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-0.5 h-[34px] pr-2 pl-1 rounded-[10px] text-[13px] font-medium text-[#D6D5D4] active:bg-[#252525] cursor-pointer outline-none shrink-0"
    >
        <svg
            viewBox="0 0 24 24"
            className="w-[18px] h-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m15 6-6 6 6 6" />
        </svg>
        {label}
    </button>
)

interface MobileTopBarProps {
    /** defaults to the menu button */
    left?: React.ReactNode
    title?: React.ReactNode
    right?: React.ReactNode
    /** set on home, where the bar shows the inbox bell (moves the unread dot there) */
    hasInboxButton?: boolean
    className?: string
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
    left,
    title,
    right,
    hasInboxButton = false,
    className,
}) => (
    <div
        className={cn(
            'md:hidden sticky top-0 z-30 h-11 shrink-0 flex items-center gap-1.5 px-2 bg-[#141414] select-none',
            className
        )}
    >
        <div className="flex items-center min-w-[34px]">
            {left ?? <MobileMenuButton hasInboxButton={hasInboxButton} />}
        </div>
        <div className="flex-1 min-w-0 text-center text-[13px] font-medium text-[#D6D5D4] truncate">
            {title}
        </div>
        <div className="flex items-center justify-end min-w-[34px]">{right}</div>
    </div>
)
