import React from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Inbox } from 'lucide-react'

interface NotificationsPopoverProps {
    isOpen: boolean
    anchorRef: React.RefObject<HTMLElement | null>
    onClose: () => void
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
    isOpen,
    anchorRef,
    onClose,
}) => {
    const popoverRef = React.useRef<HTMLDivElement | null>(null)
    const [position, setPosition] = React.useState<{
        bottom: number
        left: number
        width: number
    } | null>(null)

    React.useLayoutEffect(() => {
        if (!isOpen || !anchorRef.current || typeof window === 'undefined') {
            return
        }

        const updatePosition = () => {
            const anchor = anchorRef.current
            if (!anchor) return

            const rect = anchor.getBoundingClientRect()

            setPosition({
                bottom: window.innerHeight - rect.top + 8,
                left: rect.left - 260 + rect.width, // align to right or just fixed width. Wait, rect.left is the notification icon. Let's align left to something reasonable or just fixed width of 300. We will set left to rect.left - 250 so it opens to the left.
                width: 280,
            })
        }

        updatePosition()
        window.addEventListener('resize', updatePosition)

        return () => {
            window.removeEventListener('resize', updatePosition)
        }
    }, [anchorRef, isOpen])

    React.useEffect(() => {
        if (!isOpen) return

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null
            if (
                (target && popoverRef.current?.contains(target)) ||
                (target && anchorRef.current?.contains(target))
            ) {
                return
            }
            onClose()
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('touchstart', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('touchstart', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [anchorRef, isOpen, onClose])

    if (!isOpen || !position || typeof document === 'undefined') {
        return null
    }

    return createPortal(
        <div
            ref={popoverRef}
            className="fixed z-[100] rounded-2xl border border-[#2E2D2C] bg-[#1E1D1C] shadow-2xl p-2 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col"
            style={{
                bottom: position.bottom,
                left: Math.max(10, position.left), // Ensure it doesn't go offscreen
                width: position.width,
                height: 308,
            }}
        >
            <div className="flex items-center justify-between px-3 py-1.5 mb-1">
                <span className="text-[14px] font-medium text-[#CBCACA]">Notifications</span>
                <button className="text-[#969593] hover:text-[#CBCACA] transition-colors">
                    <MoreHorizontal className="w-[18px] h-[18px]" />
                </button>
            </div>

            <div className="h-[1px] bg-[#2B2A29] mx-1 mb-1.5 mt-1" />
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-10 h-10 mb-3 rounded-xl border border-[#2E2D2C] flex items-center justify-center bg-[#252422]/50">
                    <Inbox className="w-5 h-5 text-[#969593]" />
                </div>
                <p className="text-[14px] text-[#969593] leading-snug">
                    Your notifications will
                    <br />
                    appear here
                </p>
            </div>
        </div>,
        document.body
    )
}
