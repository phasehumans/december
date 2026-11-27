import { Gitlab } from 'lucide-react'
import React from 'react'

import {
    GIT_HOST_LABELS,
    PULL_REQUEST_STATE_LABELS,
    pullRequestRowAsSession,
    type PullRequestRow,
    type PullRequestState,
} from '@/features/pullrequests/lib/pullRequests'
import {
    MetaDot,
    RelativeTime,
    RunStatus,
    listRowClass,
} from '@/features/sessions/components/ListParts'
import {
    SESSION_MENU_WIDTH,
    SessionMenuItems,
    SessionSheetItems,
    sessionMenuPanelClass,
    useMenuKeys,
} from '@/features/sessions/components/SessionMenu'
import { SessionTags } from '@/features/sessions/components/SessionRowParts'
import { useSessionLinks } from '@/features/sessions/hooks/useSessionLinks'
import {
    isNewTabClick,
    openSessionInNewTab,
    sessionPath,
} from '@/features/sessions/lib/sessionLinks'
import { BottomSheet } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

const STATE_TAG_CLASS: Record<PullRequestState, string> = {
    open: 'bg-emerald-500/10 text-emerald-400',
    draft: 'bg-[#262626] text-[#8F8E8D]',
    merged: 'bg-[#C084FC]/[0.12] text-[#C084FC]',
    closed: 'bg-red-500/10 text-red-400',
}

/** the room the menu needs below the pointer or the ⋯ before it opens up instead */
const MENU_ROOM = 320

type RowAction = (row: PullRequestRow, event?: React.MouseEvent) => void

interface PullRequestListRowProps {
    row: PullRequestRow
    isMenuOpen: boolean
    onOpen: (sessionId: string) => void
    onToggleMenu: (sessionId: string, event: React.MouseEvent) => void
    onCloseMenu: () => void
    onToggleArchive: RowAction
    onTags: RowAction
    onDelete: RowAction
    onStop: (sessionId: string, event?: React.MouseEvent) => void
    /** Newest and Oldest show when the pull request was opened */
    showCreated: boolean
}

const StateTag: React.FC<{ state: PullRequestState }> = ({ state }) => (
    <span
        className={cn(
            'inline-flex items-center rounded-full px-2 py-px text-[11px] font-medium whitespace-nowrap shrink-0',
            STATE_TAG_CLASS[state]
        )}
    >
        {PULL_REQUEST_STATE_LABELS[state]}
    </span>
)

const HostIcon: React.FC<{ row: PullRequestRow; className: string }> = ({ row, className }) =>
    row.gitProvider === 'GITLAB' ? (
        <Gitlab className={className} />
    ) : (
        <Icons.Github className={className} />
    )

/** repo #number · branch · +lines -lines · time. phones leave the line counts out */
const PullRequestMeta: React.FC<{
    row: PullRequestRow
    showCreated: boolean
    showLines: boolean
}> = ({ row, showCreated, showLines }) => (
    <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-[#7B7A79]">
        <span className="truncate shrink-[2]" title={row.repo ?? undefined}>
            {row.repo ? `${row.repo.split('/').pop()} ` : ''}#{row.number}
        </span>
        {row.branch && (
            <>
                <MetaDot />
                <span className="truncate font-mono text-[11.5px]">{row.branch}</span>
            </>
        )}
        {showLines && row.additions != null && row.deletions != null && (
            <>
                <MetaDot />
                <span className="shrink-0 font-mono text-[11.5px]">
                    <span className="text-emerald-400/80">+{row.additions}</span>{' '}
                    <span className="text-red-400/80">-{row.deletions}</span>
                </span>
            </>
        )}
        <MetaDot />
        <span className="shrink-0">
            {showCreated ? (
                <>
                    Opened <RelativeTime iso={row.createdAt} label="Opened" />
                </>
            ) : (
                <RelativeTime iso={row.updatedAt} label="Updated" />
            )}
        </span>
    </div>
)

// one pull request in the list, with the same ⋯ menu as the Sessions rows (review page
// 5dLGLxX7ZfJgqPFg33DzYF, all recommended picks): open on the host, new session in the
// repository, Tags, Archive or Unarchive, Stop while it runs, Delete. no Rename (the row
// shows the pull request title) and no Pin (this list has no pinned-first order).
// desktop: the ⋯ and the host icon show on hover, a right-click opens the menu at the
// pointer, the title is a link. phones: two lines and a bottom sheet.
export const PullRequestListRow: React.FC<PullRequestListRowProps> = ({
    row,
    isMenuOpen,
    onOpen,
    onToggleMenu,
    onCloseMenu,
    onToggleArchive,
    onTags,
    onDelete,
    onStop,
    showCreated,
}) => {
    const [menuDirection, setMenuDirection] = React.useState<'down' | 'up'>('down')
    // set by a right-click: where the menu sits inside the row. null when the ⋯ opened it
    const [menuPoint, setMenuPoint] = React.useState<React.CSSProperties | null>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)
    // a press on the ⋯ is not a click outside, so a second click closes the menu
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const isPhone = useIsPhone()
    const linksFor = useSessionLinks()

    React.useEffect(() => {
        if (!isMenuOpen || isPhone) return
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
                onCloseMenu()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isMenuOpen, isPhone, onCloseMenu])
    useMenuKeys(isMenuOpen && !isPhone, menuRef, triggerRef, onCloseMenu)

    const host = GIT_HOST_LABELS[row.gitProvider]
    const isWorking = row.vmStatus === 'RUNNING' || row.vmStatus === 'PROVISIONING'
    const links = linksFor(pullRequestRowAsSession(row))
    // an "open" row of the dropdown closes the menu, then runs. the phone sheet closes itself
    const closing = (fn?: () => void) =>
        fn &&
        ((event?: React.MouseEvent) => {
            event?.stopPropagation()
            onCloseMenu()
            fn()
        })
    const menuProps = {
        isArchived: row.isArchived,
        canStop: isWorking,
        onTags: (event?: React.MouseEvent) => onTags(row, event),
        onToggleArchive: (event?: React.MouseEvent) => onToggleArchive(row, event),
        onStop: (event?: React.MouseEvent) => onStop(row.sessionId, event),
        onDelete: (event?: React.MouseEvent) => onDelete(row, event),
        openPullRequestLabel: `Open on ${host}`,
    }

    const openMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        setMenuDirection(
            window.innerHeight - rect.bottom < MENU_ROOM && rect.top > MENU_ROOM ? 'up' : 'down'
        )
        setMenuPoint(null)
        onToggleMenu(row.sessionId, event)
    }

    const menuButton = (padding: string, ref?: React.Ref<HTMLButtonElement>) => (
        <button
            ref={ref}
            type="button"
            onClick={openMenu}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label="Pull request options"
            className={cn(
                'rounded-lg text-[#7B7A79] transition-all hover:bg-[#242323] hover:text-[#D6D5C9] shrink-0',
                padding,
                isMenuOpen && 'bg-[#242323] text-[#D6D5C9]'
            )}
        >
            <Icons.MoreHorizontal className="h-4 w-4" />
        </button>
    )

    const tags = (
        <SessionTags
            tags={row.tags}
            onEdit={(event) => {
                event.stopPropagation()
                onTags(row, event)
            }}
        />
    )

    if (isPhone) {
        return (
            <>
                <div
                    className={cn('relative flex flex-col gap-1 py-2.5', listRowClass)}
                    onClick={() => onOpen(row.sessionId)}
                >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="truncate text-[14px] font-medium text-[#D6D5C9]">
                                {row.title}
                            </span>
                            <RunStatus vmStatus={row.vmStatus} />
                        </div>
                        {menuButton('p-1.5')}
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                        <PullRequestMeta row={row} showCreated={showCreated} showLines={false} />
                        <div className="flex items-center gap-1.5 shrink-0">
                            {tags}
                            <StateTag state={row.state} />
                        </div>
                    </div>
                </div>

                {/* clicks inside the sheet never reach the row */}
                <div onClick={(event) => event.stopPropagation()}>
                    <BottomSheet
                        isOpen={isMenuOpen}
                        onClose={onCloseMenu}
                        ariaLabel="Pull request options"
                        header={
                            <div className="px-3.5 pb-1.5 text-[12px] text-[#7B7A79] truncate">
                                {row.title}
                            </div>
                        }
                    >
                        <SessionSheetItems
                            {...menuProps}
                            onOpenPullRequest={links.onOpenPullRequest}
                            onNewInRepo={links.onNewInRepo}
                            openPullRequestIcon={<HostIcon row={row} className="h-4 w-4" />}
                        />
                    </BottomSheet>
                </div>
            </>
        )
    }

    // a right-click on the row: the same menu at the pointer, kept inside the window
    const openMenuAt = (event: React.MouseEvent<HTMLDivElement>) => {
        // the menu key of a keyboard gives no pointer position: the browser menu stays
        if (event.clientX === 0 && event.clientY === 0) return
        event.preventDefault()
        const box = event.currentTarget.getBoundingClientRect()
        const x = Math.max(8, Math.min(event.clientX, window.innerWidth - SESSION_MENU_WIDTH - 8))
        const up = window.innerHeight - event.clientY < MENU_ROOM && event.clientY > MENU_ROOM
        setMenuPoint({
            left: x - box.left,
            ...(up ? { bottom: box.bottom - event.clientY } : { top: event.clientY - box.top }),
        })
        if (!isMenuOpen) onToggleMenu(row.sessionId, event)
    }
    // ctrl, cmd and middle click open a new tab. the title link does this by itself
    const opensNewTab = (event: React.MouseEvent) =>
        isNewTabClick(event) && !(event.target as HTMLElement).closest('a')
    const desktopMenuProps = {
        ...menuProps,
        onOpenPullRequest: closing(links.onOpenPullRequest),
        onNewInRepo: closing(links.onNewInRepo),
    }

    return (
        <div
            className={cn('group relative flex items-center gap-3 min-w-0', listRowClass)}
            style={{ zIndex: isMenuOpen ? 50 : undefined }}
            onClick={(event) => {
                if (opensNewTab(event)) {
                    openSessionInNewTab(row.sessionId)
                    return
                }
                onOpen(row.sessionId)
            }}
            onAuxClick={(event) => {
                if (event.button === 1 && opensNewTab(event)) openSessionInNewTab(row.sessionId)
            }}
            onContextMenu={openMenuAt}
        >
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                    <a
                        href={sessionPath(row.sessionId)}
                        draggable={false}
                        onClick={(event) => {
                            // a new tab click: the browser follows the link, the row must not
                            // also open the session here
                            if (isNewTabClick(event)) event.stopPropagation()
                            else event.preventDefault()
                        }}
                        className="truncate text-[14px] font-medium text-[#D6D5C9] transition-colors hover:text-white outline-none focus-visible:underline"
                    >
                        {row.title}
                    </a>
                    <RunStatus vmStatus={row.vmStatus} />
                </div>
                <PullRequestMeta row={row} showCreated={showCreated} showLines />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                {tags}
                <StateTag state={row.state} />
            </div>

            {row.url && (
                <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open pull request ${row.number} on ${host}`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    className={cn(
                        'p-1 rounded-md text-[#7B7A79] hover:text-white hover:bg-[#2E2E2E] transition-all shrink-0 focus-visible:opacity-100',
                        isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                >
                    <HostIcon row={row} className="w-4 h-4" />
                </a>
            )}

            <div
                className={cn(
                    'relative flex justify-center',
                    isMenuOpen
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'
                )}
                onClick={(event) => event.stopPropagation()}
            >
                {menuButton('p-2', triggerRef)}
                {isMenuOpen && !menuPoint && (
                    <div
                        ref={menuRef}
                        role="menu"
                        className={cn(
                            'absolute right-0',
                            menuDirection === 'up' ? 'bottom-9' : 'top-9',
                            sessionMenuPanelClass,
                            'z-50'
                        )}
                    >
                        <SessionMenuItems {...desktopMenuProps} />
                    </div>
                )}
            </div>

            {/* opened by a right-click: at the pointer, and it scrolls with the row */}
            {isMenuOpen && menuPoint && (
                <div
                    ref={menuRef}
                    role="menu"
                    className={cn('absolute', sessionMenuPanelClass, 'z-50')}
                    style={menuPoint}
                    onClick={(event) => event.stopPropagation()}
                    onContextMenu={(event) => event.stopPropagation()}
                >
                    <SessionMenuItems {...desktopMenuProps} />
                </div>
            )}
        </div>
    )
}
