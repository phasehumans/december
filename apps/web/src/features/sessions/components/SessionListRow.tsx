import React, { useEffect, useRef, useState } from 'react'

import { RunStatus, listRowClass } from './ListParts'
import { SessionMenuItems, SessionSheetItems, sessionMenuPanelClass } from './SessionMenu'
import { SessionPrTooltip } from './SessionPrTooltip'
import { ListMeta, SessionTags } from './SessionRowParts'

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
    onOpenRename: RowAction
    onOpenDelete: RowAction
    onOpenTags: RowAction
    onStopSession?: (id: string, event?: React.MouseEvent) => void
}

// one session in the list: title and status, then repo · branch · time. tags, the pull
// request chip and the ⋯ menu sit on the right. on phones the menu opens as a bottom sheet.
export const SessionListRow: React.FC<SessionListRowProps> = ({
    project: session,
    isMenuOpen,
    onOpenProject,
    onToggleMenu,
    onCloseMenu,
    onToggleArchiveFromMenu,
    onOpenRename,
    onOpenDelete,
    onOpenTags,
    onStopSession,
}) => {
    const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down')
    const desktopMenuRef = useRef<HTMLDivElement>(null)
    const isPhone = useIsPhone()
    const isActive = session.vmStatus === 'RUNNING' || session.vmStatus === 'PROVISIONING'
    const canStop = Boolean(onStopSession) && isActive

    useEffect(() => {
        if (!isMenuOpen || isPhone) return
        const handleClickOutside = (event: MouseEvent) => {
            if (!desktopMenuRef.current?.contains(event.target as Node)) onCloseMenu()
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isMenuOpen, isPhone, onCloseMenu])

    const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setMenuDirection(window.innerHeight - rect.bottom < 300 && rect.top > 300 ? 'up' : 'down')
        onToggleMenu(session.id, e)
    }

    const title = session.title || 'Untitled session'
    const menuProps = {
        isArchived: Boolean(session.isArchived),
        canStop,
        onRename: (e?: React.MouseEvent) => onOpenRename(session, e),
        onTags: (e?: React.MouseEvent) => onOpenTags(session, e),
        onToggleArchive: (e?: React.MouseEvent) => onToggleArchiveFromMenu(session, e),
        onStop: (e?: React.MouseEvent) => onStopSession?.(session.id, e),
        onDelete: (e?: React.MouseEvent) => onOpenDelete(session, e),
    }
    const rowOpacity = session.isArchived && !isMenuOpen ? 'opacity-60 hover:opacity-100' : ''

    const archivedIcon = session.isArchived && (
        <Tooltip position="top" content="This session is archived">
            <span className="flex items-center justify-center rounded bg-[#242323] p-1 shrink-0">
                <Icons.Archive className="h-3 w-3 text-[#7B7A79]" />
            </span>
        </Tooltip>
    )

    const menuButton = (extra: string) => (
        <button
            type="button"
            onClick={openMenu}
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
                        <RunStatus vmStatus={session.vmStatus} />
                        {archivedIcon}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>{menuButton('')}</div>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <ListMeta session={session} />
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
                        <SessionSheetItems {...menuProps} />
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
                onClick={() => onOpenProject(session.id)}
            >
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span
                            onDoubleClick={(e) => {
                                e.stopPropagation()
                                onOpenRename(session, e)
                            }}
                            className="truncate text-[14px] font-medium text-[#D6D5C9] transition-colors hover:text-white"
                            title="Double-click to rename"
                        >
                            {title}
                        </span>
                        <RunStatus vmStatus={session.vmStatus} />
                        {archivedIcon}
                    </div>
                    <ListMeta session={session} />
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
                    {menuButton('p-2')}
                    {isMenuOpen && !isPhone && (
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
                            <SessionMenuItems {...menuProps} />
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
