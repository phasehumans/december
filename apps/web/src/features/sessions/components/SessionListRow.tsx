import React, { useEffect, useRef, useState } from 'react'

import { RunStatus, listRowClass } from './ListParts'
import {
    SESSION_MENU_WIDTH,
    SessionMenuItems,
    SessionSheetItems,
    sessionMenuPanelClass,
    useMenuKeys,
} from './SessionMenu'
import { SessionPrTooltip } from './SessionPrTooltip'
import { ListMeta, SessionTags } from './SessionRowParts'

import { useSessionLinks } from '@/features/sessions/hooks/useSessionLinks'
import {
    isNewTabClick,
    openSessionInNewTab,
    sessionPath,
} from '@/features/sessions/lib/sessionLinks'
import { BottomSheet } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

type RowAction = (session: any, event?: React.MouseEvent) => void

interface SessionListRowProps {
    project: any // a BackendSession
    isMenuOpen: boolean
    onOpenProject: (id: string) => void
    onToggleMenu: (id: string, event: React.MouseEvent) => void
    onCloseMenu: () => void
    onToggleArchiveFromMenu: RowAction
    onTogglePinFromMenu?: RowAction
    onOpenRename: RowAction
    onOpenDelete: RowAction
    onOpenTags: RowAction
    onStopSession?: (id: string, event?: React.MouseEvent) => void
    /** which time the grey line shows. follows the sort */
    timeField?: 'updated' | 'created'
    /** archived rows are dim in a mixed list. off when the list shows only archived */
    dimArchived?: boolean
}

/** the room the menu needs below the pointer or the ⋯ before it opens up instead */
const MENU_ROOM = 320

// one session in the list: title and status, then repo · branch · time. tags, the pull
// request chip and the ⋯ menu sit on the right. on phones the menu opens as a bottom sheet.
// on desktop a right-click opens the same menu at the pointer, the title is a link, and
// ctrl, cmd and middle click on the row open the session in a new tab.
export const SessionListRow: React.FC<SessionListRowProps> = ({
    project: session,
    isMenuOpen,
    onOpenProject,
    onToggleMenu,
    onCloseMenu,
    onToggleArchiveFromMenu,
    onTogglePinFromMenu,
    onOpenRename,
    onOpenDelete,
    onOpenTags,
    onStopSession,
    timeField = 'updated',
    dimArchived = true,
}) => {
    const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down')
    // set by a right-click: where the menu sits inside the row. null when the ⋯ opened it
    const [menuPoint, setMenuPoint] = useState<React.CSSProperties | null>(null)
    const desktopMenuRef = useRef<HTMLDivElement>(null)
    // the desktop ⋯: a press on it is not a click outside, so a second click closes the menu
    const desktopTriggerRef = useRef<HTMLButtonElement>(null)
    const isPhone = useIsPhone()
    const linksFor = useSessionLinks()
    const isActive = session.vmStatus === 'RUNNING' || session.vmStatus === 'PROVISIONING'
    const canStop = Boolean(onStopSession) && isActive

    useEffect(() => {
        if (!isMenuOpen || isPhone) return
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (
                !desktopMenuRef.current?.contains(target) &&
                !desktopTriggerRef.current?.contains(target)
            ) {
                onCloseMenu()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isMenuOpen, isPhone, onCloseMenu])
    // Escape, arrows, Home and End, like the Recent menus
    useMenuKeys(isMenuOpen && !isPhone, desktopMenuRef, desktopTriggerRef, onCloseMenu)

    const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setMenuDirection(
            window.innerHeight - rect.bottom < MENU_ROOM && rect.top > MENU_ROOM ? 'up' : 'down'
        )
        setMenuPoint(null)
        onToggleMenu(session.id, e)
    }

    // a right-click on the desktop row: the same menu at the pointer, kept inside the window
    const openMenuAt = (e: React.MouseEvent<HTMLDivElement>) => {
        // the menu key of a keyboard gives no pointer position: the browser menu stays
        if (e.clientX === 0 && e.clientY === 0) return
        e.preventDefault()
        const row = e.currentTarget.getBoundingClientRect()
        const x = Math.max(8, Math.min(e.clientX, window.innerWidth - SESSION_MENU_WIDTH - 8))
        const up = window.innerHeight - e.clientY < MENU_ROOM && e.clientY > MENU_ROOM
        setMenuPoint({
            left: x - row.left,
            ...(up ? { bottom: row.bottom - e.clientY } : { top: e.clientY - row.top }),
        })
        if (!isMenuOpen) onToggleMenu(session.id, e)
    }

    // ctrl, cmd and middle click open a new tab. the title link does this by itself
    const opensNewTab = (e: React.MouseEvent) =>
        isNewTabClick(e) && !(e.target as HTMLElement).closest('a')

    const title = session.title || 'Untitled session'
    const links = linksFor(session)
    // an "open" row of the dropdown closes the menu, then runs. the phone sheet closes itself
    const closing = (fn?: () => void) =>
        fn &&
        ((e?: React.MouseEvent) => {
            e?.stopPropagation()
            onCloseMenu()
            fn()
        })
    const menuProps = {
        isArchived: Boolean(session.isArchived),
        isPinned: Boolean(session.isPinned),
        onTogglePin: onTogglePinFromMenu
            ? (e?: React.MouseEvent) => onTogglePinFromMenu(session, e)
            : undefined,
        canStop,
        onRename: (e?: React.MouseEvent) => onOpenRename(session, e),
        onTags: (e?: React.MouseEvent) => onOpenTags(session, e),
        onToggleArchive: (e?: React.MouseEvent) => onToggleArchiveFromMenu(session, e),
        onStop: (e?: React.MouseEvent) => onStopSession?.(session.id, e),
        onDelete: (e?: React.MouseEvent) => onOpenDelete(session, e),
    }
    const sheetMenuProps = {
        ...menuProps,
        onOpenPullRequest: links.onOpenPullRequest,
        onNewInRepo: links.onNewInRepo,
    }
    const desktopMenuProps = {
        ...menuProps,
        onOpenPullRequest: closing(links.onOpenPullRequest),
        onNewInRepo: closing(links.onNewInRepo),
    }
    const rowOpacity =
        dimArchived && session.isArchived && !isMenuOpen ? 'opacity-60 hover:opacity-100' : ''

    const archivedIcon = session.isArchived && (
        <Tooltip position="top" content="This session is archived">
            <span className="flex items-center justify-center rounded bg-[#242323] p-1 shrink-0">
                <Icons.Archive className="h-3 w-3 text-[#7B7A79]" />
            </span>
        </Tooltip>
    )

    // after the title, beside the archived mark and in the same small box
    const pinMark = session.isPinned && (
        <Tooltip position="top" content="This session is pinned">
            <span className="flex items-center justify-center rounded bg-[#242323] p-1 shrink-0">
                <Icons.Pin aria-label="Pinned" className="h-3 w-3 text-[#7B7A79]" />
            </span>
        </Tooltip>
    )
    const needsAnswerMark = session.needsAnswer && (
        <span className="shrink-0 text-[12px] text-amber-400">Needs answer</span>
    )

    const menuButton = (extra: string, ref?: React.Ref<HTMLButtonElement>) => (
        <button
            ref={ref}
            type="button"
            onClick={openMenu}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            className={cn(
                'rounded-lg p-1.5 text-[#7B7A79] transition-all hover:bg-[#242323] hover:text-[#D6D5C9] shrink-0',
                isMenuOpen && 'bg-[#242323] text-[#D6D5C9]',
                extra
            )}
            aria-label="Session options"
        >
            <Icons.MoreHorizontal className="h-4 w-4" />
        </button>
    )

    return (
        <>
            {/* phones */}
            <div
                className={cn(
                    'md:hidden relative flex flex-col gap-1 py-2.5',
                    listRowClass,
                    rowOpacity
                )}
                style={{ zIndex: isMenuOpen ? 50 : undefined }}
                onClick={() => onOpenProject(session.id)}
            >
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="truncate text-[14px] font-medium text-[#D6D5C9]">
                            {title}
                        </span>
                        {needsAnswerMark}
                        <RunStatus vmStatus={session.vmStatus} />
                        {pinMark}
                        {archivedIcon}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>{menuButton('')}</div>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <ListMeta session={session} timeField={timeField} />
                    <div className="flex items-center gap-1.5 shrink-0">
                        <SessionTags tags={session.tags} />
                        <SessionPrTooltip session={session} />
                    </div>
                </div>
            </div>

            {/* the phone menu: a bottom sheet; clicks inside never reach the row */}
            {isPhone && (
                <div onClick={(e) => e.stopPropagation()}>
                    <BottomSheet
                        isOpen={isMenuOpen}
                        onClose={onCloseMenu}
                        ariaLabel="Session options"
                        header={
                            <div className="px-3.5 pb-1.5 text-[12px] text-[#7B7A79] truncate">
                                {title}
                            </div>
                        }
                    >
                        <SessionSheetItems {...sheetMenuProps} />
                    </BottomSheet>
                </div>
            )}

            {/* desktop */}
            <div
                className={cn(
                    'hidden md:flex group relative items-center gap-3',
                    listRowClass,
                    rowOpacity
                )}
                style={{ zIndex: isMenuOpen ? 50 : undefined }}
                onClick={(e) => {
                    if (opensNewTab(e)) {
                        openSessionInNewTab(session.id)
                        return
                    }
                    onOpenProject(session.id)
                }}
                onAuxClick={(e) => {
                    if (e.button === 1 && opensNewTab(e)) openSessionInNewTab(session.id)
                }}
                onContextMenu={openMenuAt}
            >
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <a
                            href={sessionPath(session.id)}
                            draggable={false}
                            onClick={(e) => {
                                // a new tab click: the browser follows the link, the row
                                // must not also open the session here
                                if (isNewTabClick(e)) e.stopPropagation()
                                else e.preventDefault()
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation()
                                onOpenRename(session, e)
                            }}
                            className="truncate text-[14px] font-medium text-[#D6D5C9] transition-colors hover:text-white outline-none focus-visible:underline"
                            title="Double-click to rename"
                        >
                            {title}
                        </a>
                        {needsAnswerMark}
                        <RunStatus vmStatus={session.vmStatus} />
                        {pinMark}
                        {archivedIcon}
                    </div>
                    <ListMeta session={session} timeField={timeField} />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <SessionTags
                        tags={session.tags}
                        onEdit={(e) => {
                            e.stopPropagation()
                            onOpenTags(session, e)
                        }}
                    />
                    <SessionPrTooltip session={session} />
                </div>

                <div
                    className={cn(
                        'relative flex justify-center',
                        isMenuOpen
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {menuButton('p-2', desktopTriggerRef)}
                    {isMenuOpen && !isPhone && !menuPoint && (
                        <div
                            ref={desktopMenuRef}
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
                {isMenuOpen && !isPhone && menuPoint && (
                    <div
                        ref={desktopMenuRef}
                        role="menu"
                        className={cn('absolute', sessionMenuPanelClass, 'z-50')}
                        style={menuPoint}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.stopPropagation()}
                    >
                        <SessionMenuItems {...desktopMenuProps} />
                    </div>
                )}
            </div>
        </>
    )
}
