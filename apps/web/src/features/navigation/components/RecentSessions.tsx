import React from 'react'
import { createPortal } from 'react-dom'

import type { BackendSession } from '@/features/sessions/api/session'

import { PULL_REQUEST_STATE_CLASS } from '@/features/pullrequests/lib/pullRequests'
import { RunStatus } from '@/features/sessions/components/ListParts'
import {
    SessionMenuItems,
    sessionMenuPanelClass,
    useMenuKeys,
} from '@/features/sessions/components/SessionMenu'
import { useSessionActions } from '@/features/sessions/hooks/useSessionActions'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import { Icons } from '@/shared/components/ui/Icons'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'
import { cn } from '@/shared/lib/utils'

// the desktop sidebar Recent list (round 1 of the Recent review, all rec):
// rows fill the sidebar (up to 20) and end with "All sessions"; the ⋯ next to the header
// sorts and shows running only, remembered across reloads; each row has a ⋯ with the same
// menu as the Sessions page; archive leaves "Archived · Undo" for a few seconds.

type RecentSort = 'updated' | 'created'
type RecentShow = 'all' | 'running'
interface RecentView {
    sort: RecentSort
    show: RecentShow
}

const VIEW_KEY = 'december:recent-view'
const RECENT_LIMIT = 20
const MENU_WIDTH = 180
const DEFAULT_VIEW: RecentView = { sort: 'updated', show: 'all' }

const readView = (): RecentView => {
    try {
        const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null')
        return {
            sort: saved?.sort === 'created' ? 'created' : 'updated',
            show: saved?.show === 'running' ? 'running' : 'all',
        }
    } catch (err) {
        // Intentionally swallowed: storage blocked or bad json, the defaults are fine
        return DEFAULT_VIEW
    }
}

const writeView = (view: RecentView) => {
    try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(view))
    } catch (err) {
        // Intentionally swallowed: storage blocked, the pick lasts until reload
    }
}

export const SidebarSessionsSkeleton: React.FC = () => (
    <div className="flex flex-col gap-0.5 px-1 py-1">
        {[
            { titleW: 'w-[75%]', timeW: 'w-12' },
            { titleW: 'w-[60%]', timeW: 'w-16' },
            { titleW: 'w-[85%]', timeW: 'w-10' },
            { titleW: 'w-[50%]', timeW: 'w-14' },
            { titleW: 'w-[68%]', timeW: 'w-12' },
            { titleW: 'w-[80%]', timeW: 'w-16' },
            { titleW: 'w-[55%]', timeW: 'w-10' },
        ].map((item, i) => (
            <div key={i} className="flex flex-col gap-1 px-2.5 py-1.5 rounded-xl">
                <Skeleton className={`h-3 ${item.titleW} bg-white/[0.04] rounded`} />
                <Skeleton className={`h-2.5 ${item.timeW} bg-white/[0.02] rounded`} />
            </div>
        ))}
    </div>
)

const isActive = (session: BackendSession) =>
    session.vmStatus === 'RUNNING' || session.vmStatus === 'PROVISIONING'

const menuItemClass =
    'flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg hover:bg-[#2A2A2A] focus-visible:bg-[#2A2A2A] text-[#CBCACA] hover:text-white focus-visible:text-white transition-colors text-left text-[12px] cursor-pointer outline-none'

/** one choice in the sort and filter menu */
const ViewOption: React.FC<{ label: string; checked: boolean; onPick: () => void }> = ({
    label,
    checked,
    onPick,
}) => (
    <button
        type="button"
        role="menuitemradio"
        aria-checked={checked}
        onClick={onPick}
        className={menuItemClass}
    >
        <span>{label}</span>
        {checked && <Icons.Check className="w-3.5 h-3.5 text-white" />}
    </button>
)

interface RecentRowProps {
    session: BackendSession
    isCurrent: boolean
    isMenuOpen: boolean
    onOpen: () => void
    onMenu: (button: HTMLButtonElement) => void
}

const RecentRow: React.FC<RecentRowProps> = ({
    session,
    isCurrent,
    isMenuOpen,
    onOpen,
    onMenu,
}) => {
    const prState = session.prState ?? 'open'
    return (
        <div
            className={cn(
                'group relative flex items-center w-full px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0',
                isCurrent ? 'bg-[#1F1F1F]' : 'hover:bg-[#202020]',
                isMenuOpen && 'bg-[#202020]'
            )}
            onClick={onOpen}
        >
            <div className="flex flex-col min-w-0 pr-1.5 overflow-hidden flex-1">
                <span className="font-normal text-[12.5px] tracking-tight text-[#EDEDED] group-hover:text-white truncate leading-snug">
                    {session.title || session.projectName || 'Untitled session'}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-[#8F8E8D] tracking-tight truncate mt-[2px]">
                    {isActive(session) ? (
                        <RunStatus vmStatus={session.vmStatus} className="text-[11px] gap-1" />
                    ) : (
                        <span>{formatRelativeTime(session.updatedAt)}</span>
                    )}
                    {session.prNumber ? (
                        <>
                            <span className="text-[#555] select-none">•</span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-0.5 font-mono text-[10.5px]',
                                    PULL_REQUEST_STATE_CLASS[prState]
                                )}
                            >
                                <Icons.GitPullRequest className="w-3 h-3" />
                                <span>{session.prNumber}</span>
                            </span>
                        </>
                    ) : null}
                </div>
            </div>
            <button
                type="button"
                aria-label="Session options"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={(e) => {
                    e.stopPropagation()
                    onMenu(e.currentTarget)
                }}
                className={cn(
                    'shrink-0 p-1 rounded-md transition-all outline-none cursor-pointer',
                    isMenuOpen
                        ? 'opacity-100 bg-[#2E2E2E] text-white'
                        : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-[#8F8E8D] hover:text-white hover:bg-[#2E2E2E]'
                )}
            >
                <Icons.MoreHorizontal className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}

interface RecentSessionsProps {
    isAuthenticated: boolean
    onOpenAuth?: () => void
    onOpenProject?: (sessionId: string) => void
    onSessions?: () => void
    /** where to go after archiving or deleting the session on screen */
    onLeaveCurrent: () => void
}

export const RecentSessions: React.FC<RecentSessionsProps> = ({
    isAuthenticated,
    onOpenAuth,
    onOpenProject,
    onSessions,
    onLeaveCurrent,
}) => {
    const [view, setView] = React.useState<RecentView>(readView)
    const [viewMenu, setViewMenu] = React.useState<{ top: number; left: number } | null>(null)
    const [rowMenu, setRowMenu] = React.useState<{
        session: BackendSession
        index: number
        top: number
        right: number
        up: boolean
    } | null>(null)
    const viewTriggerRef = React.useRef<HTMLButtonElement | null>(null)
    const viewMenuRef = React.useRef<HTMLDivElement | null>(null)
    const rowTriggerRef = React.useRef<HTMLButtonElement | null>(null)
    const rowMenuRef = React.useRef<HTMLDivElement | null>(null)

    const actions = useSessionActions(onLeaveCurrent)
    const { data, isLoading, isError, refetch } = useSessions({
        type: 'WEB',
        isArchived: false,
        sortBy: view.sort === 'created' ? 'createdAt' : 'updatedAt',
        sortOrder: 'desc',
        vmStatus: view.show === 'running' ? 'running' : undefined,
        limit: RECENT_LIMIT,
    })

    // archive updates the cache before the refetch, so drop archived rows here too
    const sessions = React.useMemo(
        () => (data?.sessions || []).filter((s) => !s.isArchived && s.type !== 'SEARCH'),
        [data?.sessions]
    )

    const pickView = (next: Partial<RecentView>) => {
        const merged = { ...view, ...next }
        setView(merged)
        writeView(merged)
        setViewMenu(null)
    }

    const closeViewMenu = React.useCallback(() => setViewMenu(null), [])
    const closeRowMenu = React.useCallback(() => setRowMenu(null), [])
    useMenuKeys(Boolean(viewMenu), viewMenuRef, viewTriggerRef, closeViewMenu)
    useMenuKeys(Boolean(rowMenu), rowMenuRef, rowTriggerRef, closeRowMenu)

    // a click anywhere else closes whichever menu is open
    React.useEffect(() => {
        if (!viewMenu && !rowMenu) return
        const onDown = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node
            const inside = [viewMenuRef, viewTriggerRef, rowMenuRef, rowTriggerRef].some((r) =>
                r.current?.contains(target)
            )
            if (!inside) {
                setViewMenu(null)
                setRowMenu(null)
            }
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('touchstart', onDown)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('touchstart', onDown)
        }
    }, [viewMenu, rowMenu])

    const toggleViewMenu = (button: HTMLButtonElement) => {
        if (!isAuthenticated) {
            onOpenAuth?.()
            return
        }
        if (viewMenu) {
            setViewMenu(null)
            return
        }
        // below the ⋯, inside the sidebar (D3-b)
        const rect = button.getBoundingClientRect()
        setRowMenu(null)
        setViewMenu({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) })
    }

    const openRowMenu = (session: BackendSession, index: number, button: HTMLButtonElement) => {
        if (rowMenu?.session.id === session.id) {
            setRowMenu(null)
            return
        }
        rowTriggerRef.current = button
        const rect = button.getBoundingClientRect()
        const up = window.innerHeight - rect.bottom < 240 && rect.top > 240
        setViewMenu(null)
        setRowMenu({
            session,
            index,
            top: up ? rect.top - 4 : rect.bottom + 4,
            right: Math.max(8, window.innerWidth - rect.right),
            up,
        })
    }

    // runs a row menu action and closes the menu first
    const fromRowMenu = (fn: (session: BackendSession, index: number) => void) => () => {
        if (!rowMenu) return
        const { session, index } = rowMenu
        setRowMenu(null)
        fn(session, index)
    }

    const isRunningView = view.show === 'running'

    let body: React.ReactNode
    if (!isAuthenticated) {
        body = (
            <div className="px-2.5 py-2">
                <button
                    type="button"
                    onClick={onOpenAuth}
                    className="w-full py-1 px-2.5 rounded-lg bg-[#202020] hover:bg-[#282828] border border-[#313131] hover:border-[#3E3E3E] text-[#EDEDED] hover:text-white text-[12px] font-medium transition-all text-center cursor-pointer"
                >
                    Sign in
                </button>
            </div>
        )
    } else if ((isLoading && !data) || isSkeletonPreviewActive()) {
        body = <SidebarSessionsSkeleton />
    } else if (isError && !data) {
        body = (
            <div className="px-2.5 py-1.5 flex flex-col items-start gap-1.5 text-[12px] text-[#8F8E8D]">
                Couldn&apos;t load sessions
                <button
                    type="button"
                    onClick={() => void refetch()}
                    className="rounded-lg border border-[#383736] px-2.5 py-0.5 text-[11.5px] font-medium text-[#D6D5C9] transition-colors hover:bg-[#242323] cursor-pointer"
                >
                    Try again
                </button>
            </div>
        )
    } else if (sessions.length === 0 && !actions.undo) {
        body = isRunningView ? (
            <div className="px-2.5 py-1.5 flex flex-col items-start gap-1 text-[12px] text-[#8F8E8D]">
                No running sessions
                <button
                    type="button"
                    onClick={() => pickView({ show: 'all' })}
                    className="text-[#D6D5C9] underline decoration-[#555] underline-offset-2 hover:text-white cursor-pointer"
                >
                    Show all
                </button>
            </div>
        ) : (
            <div className="px-3 py-1.5 text-[12px] font-medium text-[#616161] tracking-tight">
                No recent sessions
            </div>
        )
    } else {
        const rows: React.ReactNode[] = sessions.map((session, index) => (
            <RecentRow
                key={session.id}
                session={session}
                isCurrent={session.id === actions.currentSessionId}
                isMenuOpen={rowMenu?.session.id === session.id}
                onOpen={() => onOpenProject?.(session.id)}
                onMenu={(button) => openRowMenu(session, index, button)}
            />
        ))
        const undo = actions.undo
        if (undo && !sessions.some((s) => s.id === undo.session.id)) {
            rows.splice(
                Math.min(undo.index, rows.length),
                0,
                <div
                    key="archived-undo"
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl text-[12px] text-[#8F8E8D] shrink-0"
                >
                    Archived
                    <button
                        type="button"
                        onClick={actions.undoArchive}
                        className="font-medium text-[#E8E8E8] hover:text-white cursor-pointer"
                    >
                        Undo
                    </button>
                </div>
            )
        }
        body = (
            <>
                {rows}
                <button
                    type="button"
                    onClick={onSessions}
                    className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-[12px] text-[#919191] hover:text-[#D6D5D4] hover:bg-[#202020] transition-colors cursor-pointer shrink-0"
                >
                    All sessions
                    <Icons.ChevronRight className="w-3 h-3" />
                </button>
            </>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-2.5 h-7 mb-0">
                <span className="font-semibold text-[11.5px] text-[#8F8E8D] tracking-tight">
                    Recent
                    {isAuthenticated && isRunningView && (
                        <span className="font-medium text-[#6E6D6C]"> · Running</span>
                    )}
                </span>
                <Tooltip content="More options" position="bottom" usePortal>
                    <button
                        ref={viewTriggerRef}
                        type="button"
                        aria-label="More options"
                        aria-haspopup="menu"
                        aria-expanded={Boolean(viewMenu)}
                        onClick={(e) => {
                            e.stopPropagation()
                            toggleViewMenu(e.currentTarget)
                        }}
                        className={cn(
                            'relative flex items-center justify-center p-1 rounded-md transition-all outline-none cursor-pointer',
                            viewMenu
                                ? 'text-[#E8E8E8] bg-[#252525]'
                                : 'text-[#919191] hover:text-[#E8E8E8] hover:bg-[#252525]'
                        )}
                    >
                        <Icons.MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                </Tooltip>
            </div>

            <div
                className="flex flex-col gap-[2px] mt-1 overflow-y-auto no-scrollbar flex-1 min-h-0 pb-2"
                onScroll={rowMenu ? closeRowMenu : undefined}
            >
                {body}
            </div>

            {viewMenu &&
                createPortal(
                    <div
                        ref={viewMenuRef}
                        role="menu"
                        aria-label="Sort and filter"
                        className="fixed z-[200] w-[180px] rounded-xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-2xl p-1 flex flex-col animate-in fade-in zoom-in-95 duration-100 font-sans text-left"
                        style={{ top: viewMenu.top, left: viewMenu.left }}
                    >
                        <div className="px-2.5 py-1 text-[11.5px] font-medium text-[#8F8E8D]">
                            Sort by
                        </div>
                        <ViewOption
                            label="Last updated"
                            checked={view.sort === 'updated'}
                            onPick={() => pickView({ sort: 'updated' })}
                        />
                        <ViewOption
                            label="Created"
                            checked={view.sort === 'created'}
                            onPick={() => pickView({ sort: 'created' })}
                        />
                        <div className="h-[1px] bg-[#2B2A29] mx-1 my-1" />
                        <div className="px-2.5 py-1 text-[11.5px] font-medium text-[#8F8E8D]">
                            Show
                        </div>
                        <ViewOption
                            label="All"
                            checked={view.show === 'all'}
                            onPick={() => pickView({ show: 'all' })}
                        />
                        <ViewOption
                            label="Running"
                            checked={view.show === 'running'}
                            onPick={() => pickView({ show: 'running' })}
                        />
                    </div>,
                    document.body
                )}

            {rowMenu &&
                createPortal(
                    <div
                        ref={rowMenuRef}
                        role="menu"
                        aria-label="Session options"
                        className={cn(
                            'fixed animate-in fade-in zoom-in-95 duration-100',
                            sessionMenuPanelClass
                        )}
                        style={{
                            right: rowMenu.right,
                            ...(rowMenu.up
                                ? { bottom: window.innerHeight - rowMenu.top }
                                : { top: rowMenu.top }),
                        }}
                    >
                        <SessionMenuItems
                            isArchived={Boolean(rowMenu.session.isArchived)}
                            canStop={isActive(rowMenu.session)}
                            onRename={fromRowMenu((s) => actions.openRename(s))}
                            onTags={fromRowMenu((s) => actions.openTags(s))}
                            onToggleArchive={fromRowMenu((s, i) => actions.toggleArchive(s, i))}
                            onStop={fromRowMenu((s) => actions.stop(s.id))}
                            onDelete={fromRowMenu((s) => actions.openDelete(s))}
                        />
                    </div>,
                    document.body
                )}

            {actions.modals}
        </div>
    )
}
