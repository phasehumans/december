import React from 'react'

import { useMenuKeys } from './SessionMenu'

import { filtersLabel } from '@/features/sessions/lib/sessionsView'
import { BottomSheet, SheetHeader, SheetRow } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

// the one sort and filter button of a list page. the Sessions and Pull requests pages
// share it (review picks M2, L1-a, C1-a, P1-a):
// - the button names what is on: "Archived · Last updated"
// - one list: Sort by (one choice), then Filter (each row is on or off, they combine)
// - a row can open a second list (Repository, Tag). a list with no values is hidden
// - the menu stays open after a pick. phones get a bottom sheet with the same rows

export interface ViewMenuOption<T extends string = string> {
    value: T
    label: string
}

/** a filter row that is on or off */
export interface ViewMenuToggle {
    key: string
    label: string
    checked: boolean
    onToggle: () => void
}

/** a filter row that opens a second list with one value or Any */
export interface ViewMenuList {
    key: string
    label: string
    value: string | null
    options: ViewMenuOption[]
    onPick: (value: string | null) => void
}

interface ViewMenuProps<T extends string> {
    sorts: ViewMenuOption<T>[]
    sort: T
    onSort: (sort: T) => void
    toggles: ViewMenuToggle[]
    lists: ViewMenuList[]
    /** names of the filters that are on, in menu order. the button shows them first */
    activeFilters: string[]
}

const panelClass =
    'z-50 flex flex-col rounded-xl border border-[#2E2D2C] bg-[#1E1E1E] p-1 shadow-2xl font-sans text-left'

const itemClass =
    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[#D6D5C9] whitespace-nowrap transition-colors hover:bg-[#2A2A2A] hover:text-white focus-visible:bg-[#2A2A2A] focus-visible:text-white outline-none cursor-pointer'

const groupLabelClass = 'px-2.5 py-1 text-[11.5px] font-medium text-[#8F8E8D]'

const sheetLabelClass = 'px-2.5 pt-2 pb-1 text-[12px] text-[#7B7A79]'

const ANY = 'Any'

/** one row with a check on the right when it is on */
const CheckRow: React.FC<{
    label: string
    checked: boolean
    onPick: () => void
    radio?: boolean
}> = ({ label, checked, onPick, radio }) => (
    <button
        type="button"
        role={radio ? 'menuitemradio' : 'menuitemcheckbox'}
        aria-checked={checked}
        onClick={onPick}
        className={itemClass}
    >
        <span className="truncate">{label}</span>
        {checked && <Icons.Check className="h-3.5 w-3.5 shrink-0 text-white" />}
    </button>
)

const sheetCheck = <Icons.Check className="h-4 w-4 shrink-0 text-white" aria-label="On" />

export function ViewMenu<T extends string>({
    sorts,
    sort,
    onSort,
    toggles,
    lists,
    activeFilters,
}: ViewMenuProps<T>) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [openList, setOpenList] = React.useState<string | null>(null)
    const wrapRef = React.useRef<HTMLDivElement>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const isPhone = useIsPhone()

    const close = React.useCallback(() => {
        setIsOpen(false)
        setOpenList(null)
    }, [])

    // desktop: a click outside the button and its menu closes it
    React.useEffect(() => {
        if (!isOpen || isPhone) return
        const onMouseDown = (event: MouseEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) close()
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [isOpen, isPhone, close])

    useMenuKeys(isOpen && !isPhone, menuRef, triggerRef, close)

    const shownLists = lists.filter((list) => list.options.length > 0)
    const activeList = shownLists.find((list) => list.key === openList) ?? null
    const valueLabel = (list: ViewMenuList) =>
        list.options.find((option) => option.value === list.value)?.label ?? list.value ?? ANY
    const hasFilters = toggles.length > 0 || shownLists.length > 0

    const filters = filtersLabel(activeFilters)
    const sortLabel = sorts.find((option) => option.value === sort)?.label ?? ''

    return (
        <div className="relative shrink-0" ref={wrapRef}>
            <button
                ref={triggerRef}
                type="button"
                aria-label="Sort and filter"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => (isOpen ? close() : setIsOpen(true))}
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-[#282828] hover:border-[#3A3A3A] bg-[#202020] px-2.5 sm:px-4 py-1.5 font-sans text-[12px] sm:text-[13px] text-[#949494] hover:text-[#EDEDED] transition-colors cursor-pointer"
            >
                <span
                    className={cn(
                        'max-w-[52vw] truncate sm:max-w-none',
                        filters && 'text-[#EDEDED]'
                    )}
                >
                    {filters && (
                        <>
                            {filters} <span className="text-[#5A5958]">·</span>{' '}
                        </>
                    )}
                    {sortLabel}
                </span>
                <Icons.ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#7B7A79]" />
            </button>

            {isOpen && !isPhone && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label="Sort and filter"
                    className={cn('absolute right-0 top-full mt-2 w-[212px]', panelClass)}
                >
                    <div className={groupLabelClass}>Sort by</div>
                    {sorts.map((option) => (
                        <CheckRow
                            key={option.value}
                            radio
                            label={option.label}
                            checked={sort === option.value}
                            onPick={() => onSort(option.value)}
                        />
                    ))}
                    {hasFilters && (
                        <>
                            <div className="mx-1 my-1 h-px bg-[#2B2A29]" />
                            <div className={groupLabelClass}>Filter</div>
                        </>
                    )}
                    {toggles.map((toggle) => (
                        <CheckRow
                            key={toggle.key}
                            label={toggle.label}
                            checked={toggle.checked}
                            onPick={toggle.onToggle}
                        />
                    ))}
                    {shownLists.map((list) => {
                        const isListOpen = openList === list.key
                        return (
                            <div key={list.key} className="relative">
                                <button
                                    type="button"
                                    role="menuitem"
                                    aria-haspopup="menu"
                                    aria-expanded={isListOpen}
                                    onClick={() => setOpenList(isListOpen ? null : list.key)}
                                    className={cn(
                                        itemClass,
                                        isListOpen && 'bg-[#2A2A2A] text-white'
                                    )}
                                >
                                    <span className="flex-1 truncate">{list.label}</span>
                                    <span className="max-w-[96px] truncate text-[12px] text-[#7B7A79]">
                                        {valueLabel(list)}
                                    </span>
                                    <Icons.ChevronRight className="h-3 w-3 shrink-0 text-[#6B6A69]" />
                                </button>
                                {isListOpen && (
                                    <div
                                        role="menu"
                                        aria-label={list.label}
                                        className={cn(
                                            'absolute right-full top-[-5px] mr-2 max-h-[280px] w-[196px] overflow-y-auto no-scrollbar',
                                            panelClass
                                        )}
                                    >
                                        <CheckRow
                                            radio
                                            label={ANY}
                                            checked={!list.value}
                                            onPick={() => list.onPick(null)}
                                        />
                                        {list.options.map((option) => (
                                            <CheckRow
                                                key={option.value}
                                                radio
                                                label={option.label}
                                                checked={list.value === option.value}
                                                onPick={() => list.onPick(option.value)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {isPhone && (
                <BottomSheet
                    isOpen={isOpen}
                    onClose={close}
                    onBack={() => {
                        if (!openList) return false
                        setOpenList(null)
                        return true
                    }}
                    ariaLabel="Sort and filter"
                    header={
                        activeList ? (
                            <SheetHeader
                                title={activeList.label}
                                onBack={() => setOpenList(null)}
                            />
                        ) : undefined
                    }
                >
                    {activeList ? (
                        <>
                            <SheetRow
                                label={ANY}
                                trailing={!activeList.value && sheetCheck}
                                onClick={() => activeList.onPick(null)}
                            />
                            {activeList.options.map((option) => (
                                <SheetRow
                                    key={option.value}
                                    label={option.label}
                                    trailing={activeList.value === option.value && sheetCheck}
                                    onClick={() => activeList.onPick(option.value)}
                                />
                            ))}
                        </>
                    ) : (
                        <>
                            <div className={sheetLabelClass}>Sort by</div>
                            {sorts.map((option) => (
                                <SheetRow
                                    key={option.value}
                                    label={option.label}
                                    trailing={sort === option.value && sheetCheck}
                                    onClick={() => onSort(option.value)}
                                />
                            ))}
                            {hasFilters && <div className={sheetLabelClass}>Filter</div>}
                            {toggles.map((toggle) => (
                                <SheetRow
                                    key={toggle.key}
                                    label={toggle.label}
                                    trailing={toggle.checked && sheetCheck}
                                    onClick={toggle.onToggle}
                                />
                            ))}
                            {shownLists.map((list) => (
                                <SheetRow
                                    key={list.key}
                                    label={list.label}
                                    trailing={
                                        <span className="flex items-center gap-1.5 text-[13px] font-normal text-[#7B7A79]">
                                            <span className="max-w-[40vw] truncate">
                                                {valueLabel(list)}
                                            </span>
                                            <Icons.ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                        </span>
                                    }
                                    onClick={() => setOpenList(list.key)}
                                />
                            ))}
                        </>
                    )}
                </BottomSheet>
            )}
        </div>
    )
}
