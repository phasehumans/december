import React from 'react'
import { createPortal } from 'react-dom'

import type { BackendSession } from '@/features/sessions/api/session'

import { PULL_REQUEST_STATE_CLASS, repoNameOf } from '@/features/pullrequests/lib/pullRequests'
import { RunStatus } from '@/features/sessions/components/ListParts'
import {
    SESSION_MENU_WIDTH,
    SessionMenuItems,
    sessionMenuPanelClass,
    useMenuKeys,
} from '@/features/sessions/components/SessionMenu'
import { useSessionActions } from '@/features/sessions/hooks/useSessionActions'
import { useSessionLinks } from '@/features/sessions/hooks/useSessionLinks'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import { isNewTabClick, sessionPath } from '@/features/sessions/lib/sessionLinks'
import { filtersLabel, shortRepoName } from '@/features/sessions/lib/sessionsView'
import { Icons } from '@/shared/components/ui/Icons'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'
import { cn } from '@/shared/lib/utils'

// the desktop sidebar Recent list:
// - rows fill the sidebar (up to 20) and end with "All sessions". a row is a link, so
//   ctrl, cmd and middle click open a new tab
// - the ⋯ next to the header sorts, filters (Running and Pull request combine), groups by
//   repository and stops the running sessions. it opens like the inbox popover (part over
//   the sidebar, part over the page), stays open after a pick, and the view is remembered
// - each row has a ⋯ with the same menu as the Sessions page. a right-click opens it at
//   the pointer. archive leaves "Archived · Undo" for a few seconds

type RecentSort = 'updated' | 'created'
interface RecentView {
    sort: RecentSort
    /** only sessions that run or start */
    running: boolean
    /** only sessions that opened a pull request */
    hasPr: boolean
    /** rows sit under the name of their repository */
    group: boolean
}

const VIEW_KEY = 'december:recent-view'
const RECENT_LIMIT = 20
/** how many running sessions the count and "Stop running sessions" cover */
const RUNNING_LIMIT = 50
const MENU_WIDTH = 180
/** the height of the list menu with every row, to keep it inside the window */
const VIEW_MENU_ROOM = 280
/** the room a row menu needs below its row before it opens up instead */
const ROW_MENU_ROOM = 320
const NO_REPO = 'No repository'
const DEFAULT_VIEW: RecentView = { sort: 'updated', running: false, hasPr: false, group: false }

const readView = (): RecentView => {
    try {
        const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null')
        return {
            sort: saved?.sort === 'created' ? 'created' : 'updated',
            // "show: running" is the shape saved before the filters could combine
            running: saved?.running === true || saved?.show === 'running',
            hasPr: saved?.hasPr === true,
            group: saved?.group === true,
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

const menuDivider = <div className="h-[1px] bg-[#2B2A29] mx-1 my-1" />

/** one row of the sort and filter menu */
const ViewOption: React.FC<{
    label: string
    checked: boolean
    onPick: () => void
    /** one of a group. without it the row is on or off by itself */
    radio?: boolean
    /** a grey number before the check */
    count?: number
}> = ({ label, checked, onPick, radio, count }) => (
    <button
        type="button"
        role={radio ? 'menuitemradio' : 'menuitemcheckbox'}
        aria-checked={checked}
        aria-label={count ? `${label}, ${count}` : undefined}
        onClick={onPick}
        className={menuItemClass}
    >
        <span>{label}</span>
        {(count || checked) && (
            <span className="flex items-center gap-1.5 shrink-0">
                {count ? <span className="text-[#7B7A79] tabular-nums">{count}</span> : null}
                {checked && <Icons.Check className="w-3.5 h-3.5 text-white" />}
            </span>
        )}
    </button>
)

/** what groups a session: the repository as the list API names it, or none */
const repoKeyOf = (session: BackendSession): string => repoNameOf(session) || NO_REPO

/**
 * the sessions with those of one repository next to each other. repositories keep the
 * order of their first session, and sessions with no repository go last
 */
const groupByRepo = (sessions: BackendSession[]): BackendSession[] => {
    const keys: string[] = []
    for (const session of sessions) {
        const key = repoKeyOf(session)
        if (!keys.includes(key)) keys.push(key)
    }
    keys.sort((a, b) => Number(a === NO_REPO) - Number(b === NO_REPO))
    return keys.flatMap((key) => sessions.filter((session) => repoKeyOf(session) === key))
}

interface RecentRowProps {
    session: BackendSession
    isCurrent: boolean
    isMenuOpen: boolean
    onOpen: () => void
    onMenu: (button: HTMLButtonElement) => void
    /** a right-click: the menu opens at the pointer */
    onMenuAt: (x: number, y: number, button: HTMLButtonElement) => void
}

const RecentRow: React.FC<RecentRowProps> = ({
    session,
    isCurrent,
    isMenuOpen,
    onOpen,
    onMenu,
    onMenuAt,
}) => {
    const menuButtonRef = React.useRef<HTMLButtonElement | null>(null)
    const prState = session.prState ?? 'open'
    return (
        <div
            className={cn(
                'group relative flex items-center w-full pr-2.5 rounded-xl transition-colors shrink-0',
                isCurrent ? 'bg-[#1F1F1F]' : 'hover:bg-[#202020]',
                isMenuOpen && 'bg-[#202020]'
            )}
            onContextMenu={(e) => {
                if (!menuButtonRef.current) return
                e.preventDefault()
                onMenuAt(e.clientX, e.clientY, menuButtonRef.current)
            }}
        >
            <a
                href={sessionPath(session.id)}
                draggable={false}
                onClick={(e) => {
                    // ctrl, cmd, shift and middle click: the browser opens the link itself
                    if (isNewTabClick(e)) return
                    e.preventDefault()
                    onOpen()
                }}
                className="flex flex-col min-w-0 pl-2.5 pr-1.5 py-1.5 overflow-hidden flex-1 rounded-xl outline-none cursor-pointer focus-visible:ring-1 focus-visible:ring-[#4A4A4A]"
            >
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
            </a>
            <button
                ref={menuButtonRef}
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
        /** where the menu sits on screen: at the ⋯ of the row, or at the pointer */
        place: React.CSSProperties
    } | null>(null)
    /** "Stop running sessions" was clicked once and asks for the second click */
    const [stopArmed, setStopArmed] = React.useState(false)
    const viewTriggerRef = React.useRef<HTMLButtonElement | null>(null)
    const viewMenuRef = React.useRef<HTMLDivElement | null>(null)
    const rowTriggerRef = React.useRef<HTMLButtonElement | null>(null)
    const rowMenuRef = React.useRef<HTMLDivElement | null>(null)

    const actions = useSessionActions(onLeaveCurrent)
    const linksFor = useSessionLinks()
    const { data, isLoading, isError, refetch } = useSessions({
        type: 'WEB',
        isArchived: false,
        sortBy: view.sort === 'created' ? 'createdAt' : 'updatedAt',
        sortOrder: 'desc',
        vmStatus: view.running ? 'running' : undefined,
        hasPr: view.hasPr || undefined,
        limit: RECENT_LIMIT,
    })
    // every running session, also when the list shows other rows: the count beside
    // Running and the sessions that "Stop running sessions" stops
    const { data: runningData } = useSessions(
        { type: 'WEB', isArchived: false, vmStatus: 'running', limit: RUNNING_LIMIT },
        { enabled: isAuthenticated }
    )
    const runningSessions = React.useMemo(
        () => (runningData?.sessions || []).filter((s) => !s.isArchived && isActive(s)),
        [runningData?.sessions]
    )
    const runningCount = runningSessions.length

    // archive updates the cache before the refetch, so drop archived rows here too. with
    // "Group by repository" on, the sessions of one repository sit next to each other
    const sessions = React.useMemo(() => {
        const rows = (data?.sessions || []).filter((s) => !s.isArchived && s.type !== 'SEARCH')
        return view.group ? groupByRepo(rows) : rows
    }, [data?.sessions, view.group])

    // the menu stays open after a pick, like the menu of the Sessions page
    const pickView = (next: Partial<RecentView>) => {
        const merged = { ...view, ...next }
        setView(merged)
        writeView(merged)
        setStopArmed(false)
    }

    // the first click asks, the second click stops every running session
    const stopRunning = () => {
        if (!stopArmed) {
            setStopArmed(true)
            return
        }
        actions.stopMany(runningSessions.map((s) => s.id))
        setViewMenu(null)
    }

    // a closed menu forgets the first click on "Stop running sessions"
    React.useEffect(() => {
        if (!viewMenu) setStopArmed(false)
    }, [viewMenu])

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
        // placed like the inbox popover: the left edge of the menu sits at the left edge of
        // the ⋯, so a part is over the sidebar and the rest is over the page. it opens
        // below the ⋯, and moves up when the window is too short
        const rect = button.getBoundingClientRect()
        setRowMenu(null)
        setViewMenu({
            top: Math.max(10, Math.min(rect.bottom + 6, window.innerHeight - VIEW_MENU_ROOM - 10)),
            left: Math.max(10, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 10)),
        })
    }

    const openRowMenu = (session: BackendSession, index: number, button: HTMLButtonElement) => {
        if (rowMenu?.session.id === session.id) {
            setRowMenu(null)
            return
        }
        rowTriggerRef.current = button
        const rect = button.getBoundingClientRect()
        const up = window.innerHeight - rect.bottom < ROW_MENU_ROOM && rect.top > ROW_MENU_ROOM
        setViewMenu(null)
        setRowMenu({
            session,
            index,
            place: {
                // the right edge under the ⋯, but never past the left edge of the window:
                // the menu is wider than the space left of the ⋯ in the sidebar
                left: Math.max(8, rect.right - SESSION_MENU_WIDTH),
                ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            },
        })
    }

    // a right-click on a row: the same menu at the pointer, kept inside the window
    const openRowMenuAt = (
        session: BackendSession,
        index: number,
        x: number,
        y: number,
        button: HTMLButtonElement
    ) => {
        // the menu key of a keyboard gives no pointer position: open at the ⋯ instead
        if (x === 0 && y === 0) {
            if (rowMenu?.session.id !== session.id) openRowMenu(session, index, button)
            return
        }
        rowTriggerRef.current = button
        const up = window.innerHeight - y < ROW_MENU_ROOM && y > ROW_MENU_ROOM
        setViewMenu(null)
        setRowMenu({
            session,
            index,
            place: {
                left: Math.max(8, Math.min(x, window.innerWidth - SESSION_MENU_WIDTH - 8)),
                ...(up ? { bottom: window.innerHeight - y } : { top: y }),
            },
        })
    }

    // runs a row menu action and closes the menu first
    const fromRowMenu = (fn: (session: BackendSession, index: number) => void) => () => {
        if (!rowMenu) return
        const { session, index } = rowMenu
        setRowMenu(null)
        fn(session, index)
    }

    // the "open" rows close the menu first, like the other rows
    const rowLinks = rowMenu ? linksFor(rowMenu.session) : null
    const closing = (fn?: () => void) =>
        fn &&
        (() => {
            setRowMenu(null)
            fn()
        })

    const filterNames = [view.running && 'Running', view.hasPr && 'Pull request'].filter(
        (name): name is string => Boolean(name)
    )
    const filters = filtersLabel(filterNames)
    const isRunningOnly = view.running && !view.hasPr

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
        body = filters ? (
            <div className="px-2.5 py-1.5 flex flex-col items-start gap-1 text-[12px] text-[#8F8E8D]">
                {isRunningOnly ? 'No running sessions' : 'No sessions found'}
                <button
                    type="button"
                    onClick={() => pickView({ running: false, hasPr: false })}
                    className="text-[#D6D5C9] underline decoration-[#555] underline-offset-2 hover:text-white cursor-pointer"
                >
                    {isRunningOnly ? 'Show all' : 'Clear filters'}
                </button>
            </div>
        ) : (
            <div className="px-3 py-1.5 text-[12px] font-medium text-[#616161] tracking-tight">
                No recent sessions
            </div>
        )
    } else {
        const undo = actions.undo
        const undoAt =
            undo && !sessions.some((s) => s.id === undo.session.id)
                ? Math.min(undo.index, sessions.length)
                : -1
        // with groups on, the undo line stays in the group of the archived row
        const undoKey = undo && view.group ? repoKeyOf(undo.session) : null
        const undoLine = (
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
        const rows: React.ReactNode[] = []
        let lastKey: string | null = null
        sessions.forEach((session, index) => {
            const key = repoKeyOf(session)
            const startsGroup = view.group && key !== lastKey
            const undoInThisGroup = index === undoAt && startsGroup && undoKey === key
            if (index === undoAt && !undoInThisGroup) rows.push(undoLine)
            if (startsGroup) {
                rows.push(
                    <div
                        key={`repo-${key}`}
                        className="px-2.5 pt-2 pb-0.5 first:pt-0.5 text-[11px] text-[#6E6D6C] tracking-tight truncate shrink-0"
                    >
                        {key === NO_REPO ? NO_REPO : shortRepoName(key)}
                    </div>
                )
            }
            if (undoInThisGroup) rows.push(undoLine)
            lastKey = key
            rows.push(
                <RecentRow
                    key={session.id}
                    session={session}
                    isCurrent={session.id === actions.currentSessionId}
                    isMenuOpen={rowMenu?.session.id === session.id}
                    onOpen={() => onOpenProject?.(session.id)}
                    onMenu={(button) => openRowMenu(session, index, button)}
                    onMenuAt={(x, y, button) => openRowMenuAt(session, index, x, y, button)}
                />
            )
        })
        if (undoAt === sessions.length) rows.push(undoLine)
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
                    {isAuthenticated && filters && (
                        <span className="font-medium text-[#6E6D6C]"> · {filters}</span>
                    )}
                </span>
                {/* no tooltip while the menu is open: it would sit on the first row */}
                <Tooltip
                    content="More options"
                    position="bottom"
                    usePortal
                    disabled={Boolean(viewMenu)}
                >
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
                            radio
                            label="Last updated"
                            checked={view.sort === 'updated'}
                            onPick={() => pickView({ sort: 'updated' })}
                        />
                        <ViewOption
                            radio
                            label="Newest"
                            checked={view.sort === 'created'}
                            onPick={() => pickView({ sort: 'created' })}
                        />
                        {menuDivider}
                        <div className="px-2.5 py-1 text-[11.5px] font-medium text-[#8F8E8D]">
                            Filter
                        </div>
                        <ViewOption
                            label="Running"
                            count={runningCount}
                            checked={view.running}
                            onPick={() => pickView({ running: !view.running })}
                        />
                        <ViewOption
                            label="Pull request"
                            checked={view.hasPr}
                            onPick={() => pickView({ hasPr: !view.hasPr })}
                        />
                        {menuDivider}
                        <ViewOption
                            label="Group by repository"
                            checked={view.group}
                            onPick={() => pickView({ group: !view.group })}
                        />
                        {runningCount > 0 && (
                            <>
                                {menuDivider}
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={stopRunning}
                                    className={cn(
                                        menuItemClass,
                                        stopArmed &&
                                            'text-amber-400 hover:text-amber-300 focus-visible:text-amber-300'
                                    )}
                                >
                                    {stopArmed
                                        ? `Stop ${runningCount} ${runningCount === 1 ? 'session' : 'sessions'}?`
                                        : 'Stop running sessions'}
                                </button>
                            </>
                        )}
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
                        style={rowMenu.place}
                    >
                        <SessionMenuItems
                            isArchived={Boolean(rowMenu.session.isArchived)}
                            canStop={isActive(rowMenu.session)}
                            onOpenPullRequest={closing(rowLinks?.onOpenPullRequest)}
                            onNewInRepo={closing(rowLinks?.onNewInRepo)}
                            onOpenInNewTab={closing(rowLinks?.onOpenInNewTab)}
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
