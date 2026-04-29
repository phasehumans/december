import React from 'react'
import { createPortal } from 'react-dom'
import {
    User,
    Settings,
    CreditCard,
    BookOpen,
    Keyboard,
    Coins,
    LogOut,
    UserCircle,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface UserProfilePopoverProps {
    isOpen: boolean
    anchorRef: React.RefObject<HTMLElement | null>
    onClose: () => void
    userName?: string
    userEmail?: string
    onProfile?: () => void
    onDocs?: () => void
}

export const UserProfilePopover: React.FC<UserProfilePopoverProps> = ({
    isOpen,
    anchorRef,
    onClose,
    userName = 'phasehuman',
    userEmail = 'dev.chaitanyasonawane@gmail.com',
    onProfile,
    onDocs,
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
                left: rect.left,
                width: 240, // Fixed width for the profile menu
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

    const menuItems = [
        { icon: User, label: 'Profile', action: onProfile },
        { icon: Settings, label: 'Settings', action: () => console.log('Settings') },
        { icon: CreditCard, label: 'Pricing', action: () => console.log('Pricing') },
        { icon: BookOpen, label: 'Docs', action: onDocs },
        { icon: Keyboard, label: 'Keyboard shortcuts', action: () => console.log('Shortcuts') },
        { icon: Coins, label: 'Credits option', action: () => console.log('Credits') },
    ]

    return createPortal(
        <div
            ref={popoverRef}
            className="fixed z-[100] rounded-[16px] border border-white/10 bg-[#171615] shadow-2xl p-1.5 pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
            style={{
                bottom: position.bottom,
                left: position.left,
                width: position.width,
            }}
        >
            {/* User Info Header */}
            <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-[#D6D5D4] shrink-0 overflow-hidden">
                    <UserCircle className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-[#D6D5D4] truncate leading-tight">
                        {userName}
                    </span>
                    <span className="text-[11px] text-[#656565] truncate leading-tight mt-0.5">
                        {userEmail}
                    </span>
                </div>
            </div>

            <div className="h-[1px] bg-white/[0.04] mx-1 mb-1" />

            {/* Menu Items */}
            <div className="flex flex-col gap-0.5">
                {menuItems.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => {
                            if (item.action) {
                                item.action()
                            }
                            onClose()
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-[10px] hover:bg-white/[0.04] transition-colors group text-left"
                    >
                        <item.icon
                            className="w-4 h-4 text-[#969593] group-hover:text-[#D6D5D4] transition-colors"
                            strokeWidth={2}
                        />
                        <span className="text-[13px] text-[#969593] group-hover:text-[#D6D5D4] transition-colors font-medium">
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>

            <div className="h-[1px] bg-white/[0.04] mx-1 my-1" />

            {/* Sign Out Section */}
            <button
                onClick={() => {
                    console.log('Sign Out')
                    onClose()
                }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-[10px] hover:bg-white/[0.04] transition-colors group text-left"
            >
                <LogOut
                    className="w-4 h-4 text-[#969593] group-hover:text-[#D6D5D4] transition-colors"
                    strokeWidth={2}
                />
                <span className="text-[13px] text-[#969593] group-hover:text-[#D6D5D4] transition-colors font-medium">
                    Sign out
                </span>
            </button>
        </div>,
        document.body
    )
}
