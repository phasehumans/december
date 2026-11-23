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

const panelClass =
    'bg-[#1E1E1E] border border-[#2A2928] rounded-2xl p-1 shadow-lg shadow-black/40 flex flex-col'

/**
 * A prompt box menu whose rows can open a list beside it (the + menu, the key models).
 * The side list opens when the pointer rests on a row, on a click, and with the Right
 * arrow. The Left arrow or Esc closes it. In a narrow window it opens under the menu.
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
    const [sideTop, setSideTop] = React.useState(0)
    const [isSideBelow, setIsSideBelow] = React.useState(false)

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

    // the key listener reads the current rows and state through this ref
    const stateRef = React.useRef({ items, activeIndex, openId, activate, onClose })
    React.useEffect(() => {
        stateRef.current = { items, activeIndex, openId, activate, onClose }
    })

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const state = stateRef.current
            const isTyping = (event.target as HTMLElement | null)?.tagName === 'INPUT'
            const count = state.items.length
            const stop = () => {
                event.preventDefault()
                event.stopPropagation()
            }

            if (event.key === 'Escape') {
                stop()
                if (state.openId) setOpenId(null)
                else state.onClose()
                return
            }
            // a search box inside a side list keeps the other keys
            if (isTyping || count === 0) return

            if (event.key === 'ArrowDown') {
                stop()
                setActiveIndex((prev) => (prev + 1) % count)
            } else if (event.key === 'ArrowUp') {
                stop()
                setActiveIndex((prev) => (prev - 1 + count) % count)
            } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
                stop()
                state.activate(state.items[state.activeIndex])
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
                    role="menu"
                    aria-label={openItem.label}
                    className={cn(
                        'absolute z-10 w-[230px] max-w-[calc(100vw-32px)] max-h-[300px] overflow-y-auto no-scrollbar [scrollbar-width:none] animate-in fade-in duration-100',
                        panelClass,
                        isSideBelow ? 'left-6 top-[calc(100%+6px)]' : 'left-[calc(100%+6px)]'
                    )}
                    style={isSideBelow ? undefined : { top: sideTop }}
                >
                    {openItem.side}
                </div>
            )}
        </div>
    )
}
