import { MoreHorizontal, Inbox, Settings, Trash2 } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface NotificationsPopoverProps {
    isOpen: boolean
    anchorRef: React.RefObject<HTMLElement | null>
    onClose: () => void
    onSettings?: () => void
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
    isOpen,
    anchorRef,
    onClose,
    onSettings,
}) => {
    const popoverRef = useRef<HTMLDivElement | null>(null)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [position, setPosition] = useState<{
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
                left: rect.left - 250,
                width: 280,
            })
        }

        updatePosition()
        window.addEventListener('resize', updatePosition)

        return () => {
            window.removeEventListener('resize', updatePosition)
        }
    }, [anchorRef, isOpen])

    useEffect(() => {
        if (!isMenuOpen) return
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [isMenuOpen])

    React.useEffect(() => {
        if (!isOpen) return

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null
            if (
                (target && popoverRef.current?.contains(target)) ||
                (target && anchorRef.current?.contains(target)) ||
                (target && menuRef.current?.contains(target))
            ) {
                return
            }
            onClose()
            setIsMenuOpen(false)
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
                setIsMenuOpen(false)
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
                left: Math.max(10, position.left),
                width: position.width,
                height: 308,
            }}
        >
            <div className="flex items-center justify-between px-3 py-1.5 mb-1 relative">
                <span className="text-[14px] font-medium text-[#CBCACA]">Notifications</span>
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="text-[#969593] hover:text-[#CBCACA] transition-colors outline-none"
                >
                    <MoreHorizontal className="w-[18px] h-[18px]" />
                </button>

                {isMenuOpen &&
                    createPortal(
                        <div
                            ref={menuRef}
                            className="fixed w-44 bg-[#1E1D1C] border border-[#2E2D2C] rounded-xl p-1.5 shadow-2xl z-[110] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-200"
                            style={{
                                top: window.innerHeight - position.bottom - 308 + 12,
                                left: position.left + 296,
                            }}
                        >
                            <button
                                onClick={() => {
                                    onSettings?.()
                                    setIsMenuOpen(false)
                                    onClose()
                                }}
                                className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg hover:bg-[#252422] text-[#D6D5D4] text-[13.5px] transition-colors outline-none"
                            >
                                <Settings className="w-4 h-4" strokeWidth={1.5} />
                                Settings
                            </button>
                            <button
                                onClick={() => {
                                    console.log('Delete all read')
                                    setIsMenuOpen(false)
                                }}
                                className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg hover:bg-[#252422] text-[#D6D5D4] text-[13.5px] transition-colors outline-none"
                            >
                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                Delete all read
                            </button>
                        </div>,
                        document.body
                    )}
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
