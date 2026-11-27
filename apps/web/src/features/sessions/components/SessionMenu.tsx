import React from 'react'

import { SheetRow, useBottomSheet } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

// the one session menu (Q3-a): the Sessions page rows and the sidebar Recent rows show the
// same items. desktop is a dropdown in three groups (open, manage, Delete), phones are
// sheet rows with no dividers.

type MenuHandler = (event?: React.MouseEvent) => void

export interface SessionMenuProps {
    isArchived: boolean
    isPinned?: boolean
    /** shows Pin or Unpin. archived sessions cannot be pinned, so it hides for them */
    onTogglePin?: MenuHandler
    /** true while the session is running or starting: shows Stop */
    canStop: boolean
    /** left out on the Pull requests page: its rows show the pull request title */
    onRename?: MenuHandler
    onTags: MenuHandler
    onToggleArchive: MenuHandler
    onStop?: MenuHandler
    onDelete: MenuHandler
    /** the "open" rows. each one shows only when its handler is given (see useSessionLinks) */
    onOpenPullRequest?: MenuHandler
    onNewInRepo?: MenuHandler
    /** the words of the open pull request row. the Pull requests page names the host */
    openPullRequestLabel?: string
    /** its sheet icon, when the label names a host */
    openPullRequestIcon?: React.ReactNode
}

// the size of the sort and filter menu of the sidebar Recent header, on the Sessions page
// rows and the sidebar Recent rows: 12px text, 28px rows, no icons. 152 wide: the longest
// row (Open pull request) with room to spare
const itemClass =
    'flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[#CBCACA] whitespace-nowrap transition-colors hover:bg-[#2A2A2A] hover:text-white focus-visible:bg-[#2A2A2A] focus-visible:text-white outline-none cursor-pointer'

/** the width of the dropdown in px, for menus placed at the pointer */
export const SESSION_MENU_WIDTH = 152

export const sessionMenuPanelClass =
    'z-[200] flex w-[152px] flex-col rounded-xl border border-[#2E2D2C] bg-[#1E1E1E] p-1 shadow-2xl font-sans text-left'

const divider = <div className="mx-1 my-1 h-px bg-[#2B2A29]" />

/** dropdown items for desktop */
export const SessionMenuItems: React.FC<SessionMenuProps> = ({
    isArchived,
    isPinned,
    onTogglePin,
    canStop,
    onRename,
    onTags,
    onToggleArchive,
    onStop,
    onDelete,
    onOpenPullRequest,
    onNewInRepo,
    openPullRequestLabel = 'Open pull request',
}) => {
    return (
        <>
            {onOpenPullRequest && (
                <button
                    type="button"
                    role="menuitem"
                    onClick={onOpenPullRequest}
                    className={itemClass}
                >
                    {openPullRequestLabel}
                </button>
            )}
            {onNewInRepo && (
                <button type="button" role="menuitem" onClick={onNewInRepo} className={itemClass}>
                    New in this repo
                </button>
            )}
            {(onOpenPullRequest || onNewInRepo) && divider}
            {onTogglePin && !isArchived && (
                <button type="button" role="menuitem" onClick={onTogglePin} className={itemClass}>
                    {isPinned ? 'Unpin' : 'Pin'}
                </button>
            )}
            {onRename && (
                <button type="button" role="menuitem" onClick={onRename} className={itemClass}>
                    Rename
                </button>
            )}
            <button type="button" role="menuitem" onClick={onTags} className={itemClass}>
                Tags
            </button>
            <button type="button" role="menuitem" onClick={onToggleArchive} className={itemClass}>
                {isArchived ? 'Unarchive' : 'Archive'}
            </button>
            {canStop && onStop && (
                <button
                    type="button"
                    role="menuitem"
                    onClick={onStop}
                    className={cn(
                        itemClass,
                        'text-amber-400 hover:text-amber-300 focus-visible:text-amber-300'
                    )}
                >
                    Stop
                </button>
            )}
            {divider}
            <button
                type="button"
                role="menuitem"
                onClick={onDelete}
                className={cn(
                    itemClass,
                    'text-red-400 hover:text-red-300 focus-visible:text-red-300'
                )}
            >
                Delete
            </button>
        </>
    )
}

/** bottom sheet rows for phones. with confirmDelete the first tap on Delete turns the row
 * red and only the second tap deletes (P7-b). the two "open" rows leave the page, so they
 * close the sheet first */
export const SessionSheetItems: React.FC<SessionMenuProps & { confirmDelete?: boolean }> = ({
    isArchived,
    isPinned,
    onTogglePin,
    canStop,
    onRename,
    onTags,
    onToggleArchive,
    onStop,
    onDelete,
    onOpenPullRequest,
    onNewInRepo,
    openPullRequestLabel = 'Open pull request',
    openPullRequestIcon,
    confirmDelete,
}) => {
    const [armed, setArmed] = React.useState(false)
    const { closeThen } = useBottomSheet()
    return (
        <>
            {onOpenPullRequest && (
                <SheetRow
                    icon={openPullRequestIcon ?? <Icons.GitPullRequest className="h-4 w-4" />}
                    label={openPullRequestLabel}
                    onClick={() => closeThen(() => onOpenPullRequest())}
                />
            )}
            {onNewInRepo && (
                <SheetRow
                    icon={<Icons.Plus className="h-4 w-4" />}
                    label="New session in this repo"
                    onClick={() => closeThen(() => onNewInRepo())}
                />
            )}
            {onTogglePin && !isArchived && (
                <SheetRow
                    icon={<Icons.Pin className="h-4 w-4" />}
                    label={isPinned ? 'Unpin' : 'Pin'}
                    onClick={onTogglePin}
                />
            )}
            {onRename && (
                <SheetRow
                    icon={<Icons.Edit className="h-4 w-4" />}
                    label="Rename"
                    onClick={onRename}
                />
            )}
            <SheetRow icon={<Icons.Tag className="h-4 w-4" />} label="Tags" onClick={onTags} />
            <SheetRow
                icon={<Icons.Archive className="h-4 w-4" />}
                label={isArchived ? 'Unarchive' : 'Archive'}
                onClick={onToggleArchive}
            />
            {canStop && onStop && (
                <SheetRow icon={<Icons.X className="h-4 w-4" />} label="Stop" onClick={onStop} />
            )}
            <SheetRow
                icon={<Icons.Trash className="h-4 w-4" />}
                label={armed ? 'Tap again to delete' : 'Delete'}
                danger={!armed}
                confirm={armed}
                onClick={() => {
                    if (confirmDelete && !armed) {
                        setArmed(true)
                        return
                    }
                    onDelete()
                }}
            />
        </>
    )
}

/**
 * keyboard for a small menu (D6-a): focus the checked or first item on open, arrow keys,
 * Home and End move, Esc closes and gives focus back to the button that opened it
 */
export const useMenuKeys = (
    isOpen: boolean,
    menuRef: React.RefObject<HTMLElement | null>,
    triggerRef: React.RefObject<HTMLElement | null>,
    onClose: () => void
) => {
    React.useEffect(() => {
        if (!isOpen) return
        const items = (): HTMLElement[] =>
            menuRef.current
                ? Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role^="menuitem"]'))
                : []
        const first =
            menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? items()[0]
        first?.focus()

        const onKey = (e: KeyboardEvent) => {
            const list = items()
            const at = list.indexOf(document.activeElement as HTMLElement)
            if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                onClose()
                triggerRef.current?.focus()
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                list[(at + 1) % list.length]?.focus()
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                list[(at - 1 + list.length) % list.length]?.focus()
            } else if (e.key === 'Home') {
                e.preventDefault()
                list[0]?.focus()
            } else if (e.key === 'End') {
                e.preventDefault()
                list[list.length - 1]?.focus()
            } else if (e.key === 'Tab') {
                onClose()
            }
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
    }, [isOpen, menuRef, triggerRef, onClose])
}
