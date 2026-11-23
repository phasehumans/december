import React from 'react'

import { SheetRow } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'

// the one session menu (Q3-a): the Sessions page rows and the sidebar Recent rows show the
// same items. desktop is a dropdown with a divider above Delete, phones are sheet rows.

type MenuHandler = (event?: React.MouseEvent) => void

export interface SessionMenuProps {
    isArchived: boolean
    /** true while the session is running or starting: shows Stop */
    canStop: boolean
    onRename: MenuHandler
    onTags: MenuHandler
    onToggleArchive: MenuHandler
    onStop?: MenuHandler
    onDelete: MenuHandler
}

const itemClass =
    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-[#D6D5C9] transition-colors hover:bg-[#262626] focus-visible:bg-[#262626] outline-none cursor-pointer'

export const sessionMenuPanelClass =
    'z-[200] flex w-44 flex-col rounded-xl border border-[#272727] bg-[#1E1E1E] p-1 shadow-xl font-sans'

/** dropdown items for desktop */
export const SessionMenuItems: React.FC<SessionMenuProps> = ({
    isArchived,
    canStop,
    onRename,
    onTags,
    onToggleArchive,
    onStop,
    onDelete,
}) => (
    <>
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
        <div className="mx-1.5 my-1 h-px bg-[#282828]" />
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
 * red and only the second tap deletes (P7-b) */
export const SessionSheetItems: React.FC<SessionMenuProps & { confirmDelete?: boolean }> = ({
    isArchived,
    canStop,
    onRename,
    onTags,
    onToggleArchive,
    onStop,
    onDelete,
    confirmDelete,
}) => {
    const [armed, setArmed] = React.useState(false)
    return (
        <>
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
