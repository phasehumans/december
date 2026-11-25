import { Check, ChevronRight } from 'lucide-react'
import React from 'react'

import { cn } from '@/shared/lib/utils'

export interface CascadeItem {
    id: string
    label: string
    icon?: React.ReactNode
    /** grey text at the right of the row */
    hint?: string
    /** no backend yet: the row shows "Soon" and cannot be used */
    soon?: boolean
    checked?: boolean
    /** the list that opens beside the menu for this row */
    side?: React.ReactNode
    /** runs for a row with no side list */
    onPick?: () => void
}

interface CascadeMenuProps {
    items: CascadeItem[]
    ariaLabel: string
    /** which way the menu opens from its button */
    placement: 'top' | 'bottom'
    onClose: () => void
    widthClass?: string
    footer?: React.ReactNode
}

// a little longer than a pointer needs to cross a row on the way to another one
const HOVER_OPEN_MS = 120
const SIDE_WIDTH = 230
const SIDE_MAX_HEIGHT = 300
const SIDE_MIN_HEIGHT = 140
// the space between the menu and a side list that opens under it
const SIDE_GAP = 6
// the space kept between a side list and the edge of the window
const EDGE_GAP = 12

const panelClass =
    'bg-[#1E1E1E] border border-[#2A2928] rounded-2xl p-1 shadow-lg shadow-black/40 flex flex-col'

// the parts of a side list that keys move between: its search box and its rows
const SIDE_TARGETS = 'input, button:not([disabled]), a[href]'

/**
 * A prompt box menu whose rows can open a list beside it (the + menu, the key models).
 * The side list opens when the pointer rests on a row, on a click, and with the Right
 * arrow. The Right arrow and Enter also move the keys into the side list: Up and Down
 * move between its rows, Enter picks one, and Left or Esc go back to the menu.
 * In a narrow window it opens under the menu.
 * The side list always stays inside the window: it starts level with its row and moves
 * up when it would pass the bottom edge, so it cannot make the page behind it scroll.
 */
export const CascadeMenu: React.FC<CascadeMenuProps> = ({
    items,
    ariaLabel,
    placement,
    onClose,
    widthClass = 'w-[230px]',
    footer,
}) => {
    const rootRef = React.useRef<HTMLDivElement>(null)
    const rowRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
    const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const [activeIndex, setActiveIndex] = React.useState(0)
    const [openId, setOpenId] = React.useState<string | null>(null)
    const sideRef = React.useRef<HTMLDivElement>(null)
    const [sideTop, setSideTop] = React.useState(0)
    const [isSideBelow, setIsSideBelow] = React.useState(false)
    /** how far the open side list is moved up to stay inside the window */
    const [shift, setShift] = React.useState<{ id: string | null; px: number }>({
        id: null,
        px: 0,
    })
    const [sideMaxHeight, setSideMaxHeight] = React.useState(SIDE_MAX_HEIGHT)
    const sideShift = shift.id === openId ? shift.px : 0

    const clearHoverTimer = () => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
    }
    React.useEffect(() => clearHoverTimer, [])

    const openSide = React.useCallback((id: string) => {
        const row = rowRefs.current[id]
        const root = rootRef.current
        if (row && root) {
            setSideTop(row.offsetTop - 4)
            const rect = root.getBoundingClientRect()
            setIsSideBelow(rect.right + SIDE_WIDTH + 14 > window.innerWidth)
        }
        setOpenId(id)
    }, [])

    const activate = React.useCallback(
        (item: CascadeItem | undefined) => {
            if (!item || item.soon) return
            if (item.side) openSide(item.id)
            else item.onPick?.()
        },
        [openSide]
    )

    // where the keys were before they moved into a side list (the prompt box), so Left
    // and Esc can give them back
    const returnFocusRef = React.useRef<HTMLElement | null>(null)
    // set when a key opened the side list: its first row takes the keys once it shows
    const focusSideOnOpenRef = React.useRef(false)

    const sideTargets = React.useCallback(
        () => Array.from(sideRef.current?.querySelectorAll<HTMLElement>(SIDE_TARGETS) ?? []),
        []
    )

    /** moves the keys to a row of the side list. does nothing while it has no rows */
    const focusSide = React.useCallback(
        (index: number) => {
            const targets = sideTargets()
            if (targets.length === 0) return
            const active = document.activeElement as HTMLElement | null
            if (!sideRef.current?.contains(active)) returnFocusRef.current = active
            targets[(index + targets.length) % targets.length]?.focus()
        },
        [sideTargets]
    )

    const leaveSide = React.useCallback(() => {
        setOpenId(null)
        returnFocusRef.current?.focus()
        returnFocusRef.current = null
    }, [])

    React.useEffect(() => {
        if (!openId || !focusSideOnOpenRef.current) return
        focusSideOnOpenRef.current = false
        focusSide(0)
    }, [openId, focusSide])

    // a pick with Enter closes the menu and removes the row that had the keys: give
    // them back to the prompt box
    React.useEffect(
        () => () => {
            const back = returnFocusRef.current
            const active = document.activeElement
            if (back?.isConnected && (!active || active === document.body)) back.focus()
        },
        []
    )

    // keeps the open side list inside the window. its height changes when the rows load
    // and when a search filters them, so it is measured again on every size change
    React.useLayoutEffect(() => {
        const root = rootRef.current
        const side = sideRef.current
        if (!openId || !root || !side) return

        const fit = () => {
            const windowHeight = window.innerHeight
            // read from the layout, so the opening zoom of the menu does not change it
            const parentTop = root.offsetParent?.getBoundingClientRect().top ?? 0
            const rootTop = parentTop + root.offsetTop

            if (isSideBelow) {
                const top = rootTop + root.offsetHeight + SIDE_GAP
                const room = windowHeight - EDGE_GAP - top
                setSideMaxHeight(Math.max(SIDE_MIN_HEIGHT, Math.min(SIDE_MAX_HEIGHT, room)))
                return
            }

            const maxHeight = Math.min(SIDE_MAX_HEIGHT, windowHeight - 2 * EDGE_GAP)
            setSideMaxHeight(maxHeight)
            const top = rootTop + sideTop
            const height = Math.min(side.offsetHeight, maxHeight)
            const past = top + height - (windowHeight - EDGE_GAP)
            const needed = Math.max(0, Math.min(past, top - EDGE_GAP))
            // only ever moves up while the list is open: a search that makes the list
            // shorter must not move the search box under the pointer
            setShift((prev) => {
                const px = Math.max(prev.id === openId ? prev.px : 0, needed)
                return prev.id === openId && prev.px === px ? prev : { id: openId, px }
            })
        }

        fit()
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
        observer?.observe(side)
        window.addEventListener('resize', fit)
        return () => {
            observer?.disconnect()
            window.removeEventListener('resize', fit)
        }
    }, [openId, sideTop, isSideBelow])

    // the key listener reads the current rows and state through this ref
    const stateRef = React.useRef({
        items,
        activeIndex,
        openId,
        activate,
        onClose,
        focusSide,
        leaveSide,
        sideTargets,
    })
    React.useEffect(() => {
        stateRef.current = {
            items,
            activeIndex,
            openId,
            activate,
            onClose,
            focusSide,
            leaveSide,
            sideTargets,
        }
    })

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const state = stateRef.current
            const target = event.target as HTMLElement | null
            const isTyping = target?.tagName === 'INPUT'
            const isInSide = !!target && !!sideRef.current?.contains(target)
            const count = state.items.length
            const stop = () => {
                event.preventDefault()
                event.stopPropagation()
            }

            if (event.key === 'Escape') {
                stop()
                if (isInSide) state.leaveSide()
                else if (state.openId) setOpenId(null)
                else state.onClose()
                return
            }

            // the keys are in the side list
            if (isInSide) {
                const targets = state.sideTargets()
                const index = targets.indexOf(target)
                if (event.key === 'ArrowDown') {
                    stop()
                    state.focusSide(index + 1)
                } else if (event.key === 'ArrowUp') {
                    stop()
                    state.focusSide(index - 1)
                } else if (event.key === 'ArrowLeft' && !isTyping) {
                    stop()
                    state.leaveSide()
                }
                // Enter and Space reach the row itself and pick it. the search box keeps
                // Left, Right and the letters
                return
            }

            // a search box outside a side list keeps the other keys
            if (isTyping || count === 0) return

            if (event.key === 'ArrowDown') {
                stop()
                setActiveIndex((prev) => (prev + 1) % count)
            } else if (event.key === 'ArrowUp') {
                stop()
                setActiveIndex((prev) => (prev - 1 + count) % count)
            } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
                stop()
                const item = state.items[state.activeIndex]
                if (!item?.side || item.soon) {
                    state.activate(item)
                } else if (state.openId === item.id) {
                    // the list is open already: move the keys into it
                    state.focusSide(0)
                } else {
                    focusSideOnOpenRef.current = true
                    state.activate(item)
                }
            } else if (event.key === 'ArrowLeft' && state.openId) {
                stop()
                setOpenId(null)
            }
        }
        document.addEventListener('keydown', onKeyDown, true)
        return () => document.removeEventListener('keydown', onKeyDown, true)
    }, [])

    const openItem = items.find((item) => item.id === openId && item.side)

    return (
        <div
            ref={rootRef}
            role="menu"
            aria-label={ariaLabel}
            className={cn(
                'absolute left-0 z-50 max-w-[calc(100vw-32px)] animate-in fade-in zoom-in-95 duration-150',
                panelClass,
                placement === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
                widthClass
            )}
        >
            {items.map((item, index) => (
                <button
                    key={item.id}
                    ref={(el) => {
                        rowRefs.current[item.id] = el
                    }}
                    type="button"
                    role="menuitem"
                    aria-haspopup={item.side ? 'menu' : undefined}
                    aria-expanded={item.side ? openId === item.id : undefined}
                    aria-disabled={item.soon || undefined}
                    onMouseEnter={() => {
                        setActiveIndex(index)
                        clearHoverTimer()
                        if (item.soon) return
                        hoverTimerRef.current = setTimeout(() => {
                            if (item.side) openSide(item.id)
                            else setOpenId(null)
                        }, HOVER_OPEN_MS)
                    }}
                    onClick={() => {
                        clearHoverTimer()
                        activate(item)
                    }}
                    className={cn(
                        'flex items-center gap-3 px-3 py-1.5 rounded-xl text-left text-[12.5px] font-medium text-[#EDEDEF] transition-colors outline-none w-full',
                        item.soon
                            ? 'cursor-default'
                            : activeIndex === index || openId === item.id
                              ? 'bg-[#252525] cursor-pointer'
                              : 'hover:bg-[#252525] cursor-pointer'
                    )}
                >
                    <span
                        className={cn(
                            'flex items-center gap-3 min-w-0 flex-1',
                            item.soon && 'opacity-50'
                        )}
                    >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                    </span>
                    {item.hint && !item.soon && (
                        <span className="shrink-0 text-[12px] font-normal text-[#8F8E8D]">
                            {item.hint}
                        </span>
                    )}
                    {item.soon ? (
                        <span className="text-[10px] font-medium text-[#919191] border border-[#383735] rounded-full px-1.5 leading-4 shrink-0">
                            Soon
                        </span>
                    ) : item.side ? (
                        <ChevronRight className="w-[13px] h-[13px] text-[#8F8E8D] shrink-0" />
                    ) : item.checked ? (
                        <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    ) : null}
                </button>
            ))}
            {footer}

            {openItem && (
                <div
                    ref={sideRef}
                    role="menu"
                    aria-label={openItem.label}
                    className={cn(
                        'absolute z-10 w-[230px] max-w-[calc(100vw-32px)] overflow-y-auto no-scrollbar [scrollbar-width:none] animate-in fade-in duration-100',
                        // the row that has the keys looks like a hovered row. a switch
                        // keeps its own colours and lights up its row
                        '[&_button:not([role=switch]):focus-visible]:bg-[#252525] [&_div:has(>[role=switch]:focus-visible)]:bg-[#252525]',
                        panelClass,
                        isSideBelow ? 'left-6 top-[calc(100%+6px)]' : 'left-[calc(100%+6px)]'
                    )}
                    style={{
                        maxHeight: sideMaxHeight,
                        top: isSideBelow ? undefined : sideTop - sideShift,
                    }}
                >
                    {openItem.side}
                </div>
            )}
        </div>
    )
}
