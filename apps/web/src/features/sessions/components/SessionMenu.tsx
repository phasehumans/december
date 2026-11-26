import React from 'react'

import { SheetRow, useBottomSheet } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'

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
    onRename: MenuHandler
    onTags: MenuHandler
    onToggleArchive: MenuHandler
    onStop?: MenuHandler
    onDelete: MenuHandler
    /** the "open" rows. each one shows only when its handler is given (see useSessionLinks) */
    onOpenPullRequest?: MenuHandler
    onNewInRepo?: MenuHandler
}

const itemClass =
    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-[#D6D5C9] transition-colors hover:bg-[#262626] focus-visible:bg-[#262626] outline-none cursor-pointer'

/** the width of the dropdown in px (w-52), for menus placed at the pointer */
export const SESSION_MENU_WIDTH = 208

export const sessionMenuPanelClass =
    'z-[200] flex w-52 flex-col rounded-xl border border-[#272727] bg-[#1E1E1E] p-1 shadow-xl font-sans'

const divider = <div className="mx-1.5 my-1 h-px bg-[#282828]" />

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
}) => (
    <>
        {onOpenPullRequest && (
            <button type="button" role="menuitem" onClick={onOpenPullRequest} className={itemClass}>
                <Icons.GitPullRequest className="h-3.5 w-3.5 text-[#7B7A79]" /> Open pull request
            </button>
        )}
        {onNewInRepo && (
            <button type="button" role="menuitem" onClick={onNewInRepo} className={itemClass}>
                <Icons.Plus className="h-3.5 w-3.5 text-[#7B7A79]" /> New session in this repo
            </button>
        )}
        {(onOpenPullRequest || onNewInRepo) && divider}
        {onTogglePin && !isArchived && (
            <button type="button" role="menuitem" onClick={onTogglePin} className={itemClass}>
                <Icons.Pin className="h-3.5 w-3.5 text-[#7B7A79]" />
                {isPinned ? 'Unpin' : 'Pin'}
            </button>
        )}
        <button type="button" role="menuitem" onClick={onRename} className={itemClass}>
            <Icons.Edit className="h-3.5 w-3.5 text-[#7B7A79]" /> Rename
        </button>
        <button type="button" role="menuitem" onClick={onTags} className={itemClass}>
            <Icons.Tag className="h-3.5 w-3.5 text-[#7B7A79]" /> Tags
        </button>
        <button type="button" role="menuitem" onClick={onToggleArchive} className={itemClass}>
            <Icons.Archive className="h-3.5 w-3.5 text-[#7B7A79]" />
            {isArchived ? 'Unarchive' : 'Archive'}
        </button>
        {canStop && onStop && (
            <button
                type="button"
                role="menuitem"
                onClick={onStop}
                className={`${itemClass} text-amber-400 hover:text-amber-300`}
            >
                <Icons.X className="h-3.5 w-3.5" /> Stop
            </button>
        )}
        {divider}
        <button
            type="button"
            role="menuitem"
            onClick={onDelete}
            className={`${itemClass} text-red-400 hover:text-red-300`}
        >
            <Icons.Trash className="h-3.5 w-3.5" /> Delete
        </button>
    </>
)

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
    confirmDelete,
}) => {
    const [armed, setArmed] = React.useState(false)
    const { closeThen } = useBottomSheet()
    return (
        <>
            {onOpenPullRequest && (
                <SheetRow
                    icon={<Icons.GitPullRequest className="h-4 w-4" />}
                    label="Open pull request"
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
            <SheetRow icon={<Icons.Edit className="h-4 w-4" />} label="Rename" onClick={onRename} />
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
