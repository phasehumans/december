import React from 'react'
import { createPortal } from 'react-dom'

import { useBackToClose } from '@/shared/lib/useBackToClose'
import { cn } from '@/shared/lib/utils'

// mobile bottom sheet shared by the menu, inbox, session actions and settings sheets.
// - at most 85% of the screen tall, the body scrolls, the footer stays pinned
// - drag down on the handle or header to close (lists inside keep their own scroll)
// - the phone back button closes a level first (onBack), then the sheet
// - closeThen(fn) closes the sheet and runs fn after the history entry is gone, so a
//   navigation from a row is never undone by the sheet cleaning up its history entry

interface BottomSheetContextValue {
    closeThen: (fn: () => void) => void
}

const BottomSheetContext = React.createContext<BottomSheetContextValue>({
    closeThen: (fn) => fn(),
})

export const useBottomSheet = () => React.useContext(BottomSheetContext)

interface BottomSheetProps {
    isOpen: boolean
    onClose: () => void
    /** return true when the back press was handled inside the sheet (went up a level) */
    onBack?: () => boolean
    header?: React.ReactNode
    footer?: React.ReactNode
    children: React.ReactNode
    ariaLabel: string
    className?: string
    /** lift the sheet above the on-screen keyboard. for sheets that hold a form */
    avoidKeyboard?: boolean
}

/** the space the on-screen keyboard takes at the bottom of the screen */
const useKeyboardInset = (active: boolean): number => {
    const [inset, setInset] = React.useState(0)
    React.useEffect(() => {
        if (!active || typeof window === 'undefined') return
        const vv = window.visualViewport
        if (!vv) return
        const update = () =>
            setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
        update()
        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        return () => {
            vv.removeEventListener('resize', update)
            vv.removeEventListener('scroll', update)
            setInset(0)
        }
    }, [active])
    return inset
}

const CLOSE_DRAG_PX = 90
export const BottomSheet: React.FC<BottomSheetProps> = ({
    isOpen,
    onClose,
    onBack,
    header,
    footer,
    children,
    ariaLabel,
    className,
    avoidKeyboard = false,
}) => {
    const keyboardInset = useKeyboardInset(isOpen && avoidKeyboard)
    const onCloseRef = React.useRef(onClose)
    const onBackRef = React.useRef(onBack)
    React.useEffect(() => {
        onCloseRef.current = onClose
        onBackRef.current = onBack
    }, [onClose, onBack])

    // back button and back swipe: up a level, then close (shared with modals)
    const { closeThen } = useBackToClose({ isOpen, onClose, onBack })

    // drag to close, only from the handle and header
    const [dragY, setDragY] = React.useState(0)
    const dragStartRef = React.useRef<number | null>(null)
    const onPointerDown = (e: React.PointerEvent) => {
        dragStartRef.current = e.clientY
        e.currentTarget.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: React.PointerEvent) => {
        if (dragStartRef.current === null) return
        setDragY(Math.max(0, e.clientY - dragStartRef.current))
    }
    const onPointerUp = () => {
        if (dragStartRef.current === null) return
        dragStartRef.current = null
        if (dragY > CLOSE_DRAG_PX) onCloseRef.current()
        setDragY(0)
    }

    React.useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            if (onBackRef.current?.()) return
            onCloseRef.current()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen])

    const contextValue = React.useMemo(() => ({ closeThen }), [closeThen])

    if (!isOpen || typeof document === 'undefined') return null

    return createPortal(
        <BottomSheetContext.Provider value={contextValue}>
            <div
                className="md:hidden fixed inset-0 z-[170] bg-black/55 animate-in fade-in duration-200"
                onClick={() => onCloseRef.current()}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                className={cn(
                    'md:hidden fixed inset-x-0 bottom-0 z-[171] flex flex-col max-h-[85dvh] rounded-t-[18px] border-t border-[#2A2928] bg-[#1E1E1E] font-sans animate-in slide-in-from-bottom-4 fade-in duration-200',
                    dragStartRef.current === null && 'transition-transform duration-200',
                    className
                )}
                style={{
                    transform: dragY ? `translateY(${dragY}px)` : undefined,
                    bottom: keyboardInset || undefined,
                    maxHeight: keyboardInset
                        ? `calc(100dvh - ${keyboardInset}px - 24px)`
                        : undefined,
                }}
            >
                <div
                    className="shrink-0 touch-none select-none cursor-grab"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                >
                    <div className="mx-auto mt-2 mb-2 h-1 w-9 rounded-full bg-[#3A3A3A]" />
                    {header}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar px-2.5">
                    {children}
                </div>
                {footer && <div className="shrink-0 px-2.5">{footer}</div>}
                <div
                    className={
                        keyboardInset
                            ? 'shrink-0 h-2.5'
                            : 'shrink-0 h-[max(10px,env(safe-area-inset-bottom))]'
                    }
                />
            </div>
        </BottomSheetContext.Provider>,
        document.body
    )
}

interface SheetHeaderProps {
    title: React.ReactNode
    onBack?: () => void
    action?: React.ReactNode
}

// "‹ Title" row used by second-level sheets (inbox, rename, tags)
export const SheetHeader: React.FC<SheetHeaderProps> = ({ title, onBack, action }) => (
    <div className="flex items-center justify-between gap-2 px-3.5 pb-2.5">
        <div className="flex items-center gap-1 min-w-0">
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label="Back"
                    className="-ml-1.5 w-7 h-7 flex items-center justify-center rounded-lg text-[#919191] hover:text-[#D6D5D4] cursor-pointer outline-none"
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="w-[18px] h-[18px]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m15 6-6 6 6 6" />
                    </svg>
                </button>
            )}
            <span className="text-[14px] font-semibold text-[#EDEDED] truncate">{title}</span>
        </div>
        {action && <div onPointerDown={(e) => e.stopPropagation()}>{action}</div>}
    </div>
)

interface SheetRowProps {
    icon?: React.ReactNode
    label: React.ReactNode
    trailing?: React.ReactNode
    onClick?: () => void
    active?: boolean
    danger?: boolean
    /** red background, used for the "tap again to ..." confirm state */
    confirm?: boolean
}

export const SheetRow: React.FC<SheetRowProps> = ({
    icon,
    label,
    trailing,
    onClick,
    active,
    danger,
    confirm,
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'w-full flex items-center gap-2.5 h-10 px-2.5 rounded-[10px] text-left text-[14px] font-medium transition-colors outline-none cursor-pointer',
            active ? 'bg-[#262626]' : 'active:bg-[#242424]',
            danger || confirm ? 'text-[#E57373]' : 'text-[#D6D5D4]',
            confirm && 'bg-[#E57373]/[0.08]'
        )}
    >
        {icon && (
            <span
                className={cn(
                    'flex items-center justify-center shrink-0',
                    danger || confirm ? 'text-[#E57373]' : 'text-[#919191]'
                )}
            >
                {icon}
            </span>
        )}
        <span className="flex-1 min-w-0 truncate">{label}</span>
        {trailing}
    </button>
)
