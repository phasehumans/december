import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ChevronRight, Inbox, Trash2 } from 'lucide-react'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { SearchModal } from './SearchModal'

import type { Notification } from '@/features/notification/api/notification'

import { useAppStore } from '@/app/store'
import { getViewForPath } from '@/app/types'
import { notificationAPI } from '@/features/notification/api/notification'
import { useInbox } from '@/features/notification/hooks/useInbox'
import { profileAPI } from '@/features/profile/api/profile'
import { MobileSettingsLevel } from '@/features/profile/components/MobileSettingsLevel'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import {
    BottomSheet,
    SheetHeader,
    SheetRow,
    useBottomSheet,
} from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

// phones only: the menu sheet (M-C). nav rows, the last 5 sessions, then the account row
// with the inbox bell. settings, the inbox and one notification slide in as levels of the
// same sheet.

type Level = 'menu' | 'settings' | 'inbox' | 'note'

interface MobileMenuSheetProps {
    onNewThread: () => void
    onHomeClick?: () => void
    onSessions: () => void
    onProfile: () => void
    onOpenProject: (projectId: string) => void
    isAuthenticated: boolean
    onOpenAuth: () => void
}

const RECENT_LIMIT = 5

const relativeTime = (iso?: string) => {
    if (!iso) return ''
    const date = new Date(iso)
    if (isNaN(date.getTime())) return ''
    const mins = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const MenuLevel: React.FC<
    MobileMenuSheetProps & {
        onOpenSearch: () => void
        onOpenInbox: () => void
        onOpenSettings: () => void
    }
> = ({
    onNewThread,
    onHomeClick,
    onSessions,
    onOpenProject,
    isAuthenticated,
    onOpenAuth,
    onOpenSearch,
    onOpenSettings,
}) => {
    const { closeThen } = useBottomSheet()
    const navigate = useNavigate()
    const path = useLocation().pathname
    const activeProjectId = useAppStore((s) => s.activeProjectId)
    const setIsSuperCrewOpen = useAppStore((s) => s.setIsSuperCrewOpen)
    const { data: sessionsData, isLoading } = useSessions()

    // session urls are /sessions/<slug>, so only the bare list page counts as Sessions
    const isSessionsActive =
        path === '/sessions' || path === '/all-projects' || path === '/projects'
    const isPullRequestsActive = getViewForPath(path) === 'pullrequests'
    const isSettingsActive = getViewForPath(path) === 'profile'
    const isOnSession =
        path !== '/' && !isSessionsActive && !isPullRequestsActive && !isSettingsActive

    const recent = React.useMemo(
        () =>
            (sessionsData?.sessions || [])
                .filter((s) => !s.isArchived && s.type !== 'SEARCH')
                .sort(
                    (a, b) =>
                        (new Date(b.updatedAt).getTime() || 0) -
                        (new Date(a.updatedAt).getTime() || 0)
                )
                .slice(0, RECENT_LIMIT),
        [sessionsData?.sessions]
    )

    const startNew = () =>
        closeThen(() => {
            if (onNewThread) onNewThread()
            else if (onHomeClick) onHomeClick()
            else navigate('/')
            window.dispatchEvent(new CustomEvent('december:new-session'))
            setTimeout(() => document.getElementById('home-prompt-textarea')?.focus(), 50)
        })

    const requireAuth = (fn: () => void) => (isAuthenticated ? fn() : closeThen(onOpenAuth))

    return (
        <div className="flex flex-col pb-1">
            <SheetRow
                icon={
                    <span className="w-[19px] h-[19px] rounded-full bg-[#333333] flex items-center justify-center">
                        <Icons.Plus className="w-2.5 h-2.5 text-[#E8E8E8]" strokeWidth={2.5} />
                    </span>
                }
                label="New"
                onClick={startNew}
            />
            <SheetRow
                icon={<Icons.Search className="w-[17px] h-[17px]" />}
                label="Search"
                onClick={() => requireAuth(() => closeThen(onOpenSearch))}
            />
            <SheetRow
                icon={<Icons.CrewDots className="w-[17px] h-[17px]" />}
                label="Super Crew"
                trailing={
                    <span className="text-[10px] font-medium text-[#919191] border border-[#383735] rounded-full px-1.5 leading-4">
                        Soon
                    </span>
                }
                onClick={() => closeThen(() => setIsSuperCrewOpen(true))}
            />
            <SheetRow
                icon={<Icons.Folder className="w-[17px] h-[17px]" />}
                label="Sessions"
                active={isSessionsActive}
                onClick={() => closeThen(onSessions)}
            />
            <SheetRow
                icon={<Icons.GitPullRequest className="w-[17px] h-[17px]" />}
                label="Pull requests"
                active={isPullRequestsActive}
                onClick={() => requireAuth(() => closeThen(() => navigate('/pull-requests')))}
            />
            <SheetRow
                icon={<Icons.Settings className="w-[17px] h-[17px]" />}
                label="Settings"
                active={isSettingsActive}
                onClick={onOpenSettings}
            />

            {isAuthenticated && (isLoading || recent.length > 0) && (
                <>
                    <div className="px-2.5 pt-3 pb-1 text-[11.5px] font-semibold text-[#8F8E8D]">
                        Recent
                    </div>
                    {isLoading
                        ? [70, 55, 62].map((w) => (
                              <div
                                  key={w}
                                  className="h-2.5 my-2 mx-2.5 rounded bg-[#262626]"
                                  style={{ width: `${w}%` }}
                              />
                          ))
                        : recent.map((s) => {
                              const running =
                                  s.vmStatus === 'RUNNING' || s.vmStatus === 'PROVISIONING'
                              const current = isOnSession && s.id === activeProjectId
                              return (
                                  <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => closeThen(() => onOpenProject(s.id))}
                                      className={cn(
                                          'w-full flex items-center gap-2 h-9 px-2.5 rounded-[10px] text-left text-[13px] text-[#CBCACA] outline-none cursor-pointer',
                                          current ? 'bg-[#262626]' : 'active:bg-[#242424]'
                                      )}
                                  >
                                      {running && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                      )}
                                      <span className="flex-1 min-w-0 truncate">
                                          {s.title || s.projectName || 'Untitled session'}
                                      </span>
                                  </button>
                              )
                          })}
                    {!isLoading && (
                        <button
                            type="button"
                            onClick={() => closeThen(onSessions)}
                            className="w-full flex items-center justify-between h-9 px-2.5 rounded-[10px] text-[13px] text-[#919191] active:bg-[#242424] outline-none cursor-pointer"
                        >
                            All sessions
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </>
            )}
        </div>
    )
}

const AccountRow: React.FC<{ onOpenInbox: () => void; unread: boolean }> = ({
    onOpenInbox,
    unread,
}) => {
    const { closeThen } = useBottomSheet()
    const navigate = useNavigate()
    const isAuthenticated = useAppStore((s) => s.isAuthenticated)
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: isAuthenticated,
    })
    const name = profile?.name || 'Account'
    return (
        <div className="flex items-center gap-2 pt-0.5">
            <button
                type="button"
                onClick={() => closeThen(() => navigate('/settings/account'))}
                className="flex-1 min-w-0 flex items-center gap-2 h-10 px-1.5 rounded-[10px] text-left active:bg-[#242424] outline-none cursor-pointer"
            >
                <span className="w-6 h-6 rounded-full bg-[#2F3B4F] text-[#CFE0FF] text-[10.5px] font-semibold flex items-center justify-center shrink-0">
                    {name.trim().charAt(0).toUpperCase() || 'A'}
                </span>
                <span className="text-[13px] text-[#CBCACA] truncate">{name}</span>
            </button>
            <button
                type="button"
                onClick={onOpenInbox}
                aria-label="Inbox"
                className="relative w-[34px] h-[34px] flex items-center justify-center rounded-[10px] text-[#8F8E8D] active:bg-[#252525] outline-none cursor-pointer"
            >
                <Inbox className="w-[17px] h-[17px]" strokeWidth={1.8} />
                {unread && (
                    <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] rounded-full bg-[#87B2F4] border-[1.5px] border-[#1E1E1E]" />
                )}
            </button>
        </div>
    )
}

const InboxList: React.FC<{
    items: Notification[]
    isLoading: boolean
    hasMore: boolean
    onMore: () => void
    onPick: (n: Notification) => void
}> = ({ items, isLoading, hasMore, onMore, onPick }) => {
    if (isLoading)
        return (
            <div className="flex flex-col gap-3 px-3 py-2">
                {[80, 65, 72].map((w) => (
                    <div key={w} className="h-3 rounded bg-[#262626]" style={{ width: `${w}%` }} />
                ))}
            </div>
        )
    if (items.length === 0)
        return <div className="py-10 text-center text-[13px] text-[#919191]">No notifications</div>
    return (
        <div className="flex flex-col pb-2">
            {items.map((n) => (
                <button
                    key={n.id}
                    type="button"
                    onClick={() => onPick(n)}
                    className="w-full flex items-start gap-2 px-2.5 py-2.5 rounded-[10px] text-left active:bg-[#242424] outline-none cursor-pointer"
                >
                    <span
                        className={cn(
                            'mt-[6px] w-1.5 h-1.5 rounded-full shrink-0',
                            n.isRead ? 'bg-transparent' : 'bg-[#87B2F4]'
                        )}
                    />
                    <span className="flex-1 min-w-0">
                        {/* read titles go grey so unread ones stand out (L2) */}
                        <span
                            className={cn(
                                'block text-[13px] font-medium truncate',
                                n.isRead ? 'text-[#A3A2A1]' : 'text-[#EDEDED]'
                            )}
                        >
                            {n.title}
                        </span>
                        {/* two lines of the message, most fit whole (L1) */}
                        <span className="text-[12px] text-[#919191] line-clamp-2">{n.message}</span>
                    </span>
                    <span className="text-[11px] text-[#7B7A79] shrink-0">
                        {relativeTime(n.createdAt)}
                    </span>
                </button>
            ))}
            {hasMore && (
                <button
                    type="button"
                    onClick={onMore}
                    className="h-9 text-[12.5px] text-[#919191] active:text-[#D6D5D4] outline-none cursor-pointer"
                >
                    Show more
                </button>
            )}
        </div>
    )
}

/** exact time for the message view (M1-a): "Today, 2:14 PM", "Yesterday, 6:40 PM", "Nov 20, 9:02 AM" */
const exactTime = (iso?: string) => {
    if (!iso) return ''
    const date = new Date(iso)
    if (isNaN(date.getTime())) return ''
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const days = Math.floor((startOfToday.getTime() - date.getTime()) / 86400000) + 1
    if (date >= startOfToday) return `Today, ${time}`
    if (days === 1) return `Yesterday, ${time}`
    const sameYear = date.getFullYear() === startOfToday.getFullYear()
    const day = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    })
    return `${day}, ${time}`
}

/** the Open button says where it goes (M3-b). unknown links fall back to "Open" */
export const openLabelForLink = (link: string) => {
    if (!link.startsWith('/')) return 'Open'
    if (link.startsWith('/pull-requests')) return 'View pull requests'
    if (link.startsWith('/settings/billing')) return 'Open billing'
    if (link.startsWith('/settings/usage')) return 'Open usage'
    if (link.startsWith('/settings')) return 'Open settings'
    if (link.startsWith('/sessions/')) return 'Open session'
    if (link.startsWith('/sessions')) return 'View sessions'
    return 'Open'
}

const NoteDetail: React.FC<{ note: Notification }> = ({ note }) => {
    const { closeThen } = useBottomSheet()
    const navigate = useNavigate()
    const open = () => {
        const link = note.link
        if (!link) return
        if (link.startsWith('/')) closeThen(() => navigate(link))
        else window.open(link, '_blank', 'noopener,noreferrer')
    }
    return (
        <div className="flex flex-col px-3.5 pb-3">
            <span className="text-[15px] font-semibold text-[#EDEDED]">{note.title}</span>
            <span className="mt-0.5 text-[11.5px] text-[#7B7A79]">{exactTime(note.createdAt)}</span>
            <p className="mt-2.5 text-[14px] leading-[1.5] text-[#B9B8B7] whitespace-pre-wrap">
                {note.message}
            </p>
            {note.link && (
                <button
                    type="button"
                    onClick={open}
                    className="mt-4 h-9 w-full rounded-[10px] bg-[#E8E8E8] text-[#141414] text-[13px] font-medium flex items-center justify-center gap-1 outline-none cursor-pointer active:bg-white"
                >
                    {openLabelForLink(note.link)}
                    {!note.link.startsWith('/') && <ArrowUpRight className="w-3.5 h-3.5" />}
                </button>
            )}
        </div>
    )
}

export const MobileMenuSheet: React.FC<MobileMenuSheetProps> = (props) => {
    const { isAuthenticated, onNewThread, onOpenProject, onOpenAuth } = props
    const isOpen = useAppStore((s) => s.isMobileSidebarOpen)
    const setIsOpen = useAppStore((s) => s.setIsMobileSidebarOpen)
    const start = useAppStore((s) => s.mobileSheetStart)
    const [level, setLevel] = React.useState<Level>(start)
    const [note, setNote] = React.useState<Notification | null>(null)
    const [isSearchOpen, setIsSearchOpen] = React.useState(false)

    React.useEffect(() => {
        if (isOpen) {
            setLevel(start)
            setNote(null)
        }
    }, [isOpen, start])

    const inbox = useInbox(isOpen && (level === 'inbox' || level === 'note') && isAuthenticated)
    const { data: unreadData } = useQuery({
        queryKey: ['notifications-unread-count'],
        queryFn: notificationAPI.getUnreadCount,
        enabled: isAuthenticated,
        refetchInterval: 30 * 1000,
    })
    const unread = (unreadData?.count ?? 0) > 0

    const close = React.useCallback(() => setIsOpen(false), [setIsOpen])

    const goBack = React.useCallback(() => {
        if (level === 'note') {
            setLevel('inbox')
            return true
        }
        if ((level === 'inbox' && start === 'menu') || level === 'settings') {
            setLevel('menu')
            return true
        }
        return false
    }, [level, start])

    const pickNote = (n: Notification) => {
        if (!n.isRead) inbox.markAsRead.mutate(n.id)
        setNote({ ...n, isRead: true })
        setLevel('note')
    }

    let header: React.ReactNode = null
    let body: React.ReactNode
    let footer: React.ReactNode = null
    if (level === 'menu') {
        body = (
            <MenuLevel
                {...props}
                onOpenSearch={() => setIsSearchOpen(true)}
                onOpenInbox={() => setLevel('inbox')}
                onOpenSettings={() => setLevel('settings')}
            />
        )
        footer = isAuthenticated ? (
            <AccountRow unread={unread} onOpenInbox={() => setLevel('inbox')} />
        ) : null
    } else if (level === 'settings') {
        header = <SheetHeader title="Settings" onBack={() => setLevel('menu')} />
        body = <MobileSettingsLevel isAuthenticated={isAuthenticated} onOpenAuth={onOpenAuth} />
    } else if (level === 'inbox') {
        const hasRead = inbox.notifications.some((n) => n.isRead)
        header = (
            <SheetHeader
                title="Inbox"
                onBack={start === 'menu' ? () => setLevel('menu') : undefined}
                action={
                    hasRead ? (
                        <button
                            type="button"
                            onClick={() => inbox.clearRead.mutate()}
                            className="text-[12px] font-medium text-[#919191] active:text-[#D6D5D4] outline-none cursor-pointer"
                        >
                            Clear read
                        </button>
                    ) : null
                }
            />
        )
        body = (
            <InboxList
                items={inbox.notifications}
                isLoading={inbox.isLoading}
                hasMore={!!inbox.hasNextPage}
                onMore={() => inbox.fetchNextPage()}
                onPick={pickNote}
            />
        )
    } else {
        // delete is a quiet icon in the header (D1), no confirm: it is one notification
        header = (
            <SheetHeader
                title="Inbox"
                onBack={() => setLevel('inbox')}
                action={
                    note ? (
                        <button
                            type="button"
                            aria-label="Delete notification"
                            onClick={() => {
                                inbox.remove.mutate(note.id)
                                setLevel('inbox')
                            }}
                            className="w-7 h-7 -mr-1 flex items-center justify-center rounded-lg text-[#919191] active:text-[#D6D5D4] active:bg-[#262626] outline-none cursor-pointer"
                        >
                            <Trash2 className="w-[15px] h-[15px]" strokeWidth={1.8} />
                        </button>
                    ) : null
                }
            />
        )
        body = note ? <NoteDetail note={note} /> : null
    }

    return (
        <>
            <BottomSheet
                isOpen={isOpen}
                onClose={close}
                onBack={goBack}
                header={header}
                footer={footer}
                ariaLabel={level === 'menu' ? 'Menu' : level === 'settings' ? 'Settings' : 'Inbox'}
            >
                {body}
            </BottomSheet>
            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onNewThread={isAuthenticated ? onNewThread : onOpenAuth}
                onOpenSession={(sessionId) => onOpenProject(sessionId)}
                isAuthenticated={isAuthenticated}
            />
        </>
    )
}
