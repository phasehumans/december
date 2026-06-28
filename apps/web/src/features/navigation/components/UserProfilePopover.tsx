import {
    User,
    LogOut,
    ExternalLink,
    Settings as SettingsIcon,
    MessageSquare,
    CircleDollarSign,
    Loader2,
    FileClock,
} from 'lucide-react'
import React from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { Icons } from '@/shared/components/ui/Icons'

interface UserProfilePopoverProps {
    isOpen: boolean
    anchorRef: React.RefObject<HTMLElement | null>
    onClose: () => void
    userName?: string
    userEmail?: string
    onSettings?: () => void
    onProfileModal?: () => void
    onFeedbackModal?: () => void
    onDocs?: () => void
    onSignOut?: () => void
}

export const UserProfilePopover: React.FC<UserProfilePopoverProps> = ({
    isOpen,
    anchorRef,
    onClose,
    userName = 'phasehuman',
    userEmail = 'dev.chaitanyasonawane@gmail.com',
    onSettings,
    onProfileModal,
    onFeedbackModal,
    onDocs,
    onSignOut,
}) => {
    const popoverRef = React.useRef<HTMLDivElement | null>(null)
    const navigate = useNavigate()
    const { data: overview, isLoading: isOverviewLoading } = useBillingOverview()

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
                width: 280, // Decreased width by 20px
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

    const renderCreditsValue = () => {
        if (isOverviewLoading) {
            return <Loader2 className="w-3.5 h-3.5 animate-spin text-[#969593]" />
        }
        if (!overview) {
            return <span className="text-[13px] text-[#CBCACA] font-medium">$0.00</span>
        }
        const remaining = overview.creditBalance ?? 0
        return (
            <span className="text-[13px] text-[#CBCACA] font-medium">
                ${(remaining / 100).toFixed(2)}
            </span>
        )
    }

    const docsUrl =
        (typeof process !== 'undefined' ? process.env.DOCS_URL : undefined) ||
        'http://localhost:3005'

    const menuItems: Array<{
        icon: React.ComponentType<any>
        label: string
        action?: () => void
        external?: boolean
        rightElement?: React.ReactNode
        shortcut?: string
    }> = [
        { icon: User, label: 'Profile', action: onProfileModal },
        { icon: MessageSquare, label: 'Feedback', action: onFeedbackModal },
        {
            icon: Icons.DocsBook,
            label: 'Documentation',
            action: () => {
                window.open(docsUrl, '_blank')
            },
            external: true,
        },
        {
            icon: FileClock,
            label: 'Changelog',
            action: () => {
                window.open(
                    'https://github.com/phasehumans/december/blob/main/CHANGELOG.md',
                    '_blank'
                )
            },
            external: true,
        },
        {
            icon: CircleDollarSign,
            label: 'Credits',
            action: () => {
                navigate('/profile/billing')
            },
            rightElement: renderCreditsValue(),
        },
    ]

    return createPortal(
        <div
            ref={popoverRef}
            className="fixed z-[100] rounded-2xl border border-[#2E2D2C] bg-[#1F1F1F] shadow-2xl p-2 pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
            style={{
                bottom: position.bottom,
                left: position.left,
                width: position.width,
            }}
        >
            {/* User Info Header */}
            <div className="flex items-center gap-3 px-3 py-1.5 mb-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] text-[#8F8E8D] shrink-0 overflow-hidden">
                    <Icons.UserCircle className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-medium text-[#CBCACA] truncate leading-tight">
                        {userName}
                    </span>
                    <span className="text-[12px] text-[#969593] truncate leading-tight mt-0.5">
                        {userEmail}
                    </span>
                </div>
            </div>

            <div className="h-[1px] bg-[#2B2A29] mx-1 mb-1.5 mt-1" />

            {/* Menu Items */}
            <div className="flex flex-col gap-0">
                {menuItems.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => {
                            if (item.action) {
                                item.action()
                            }
                            onClose()
                        }}
                        className="flex items-center justify-between w-full px-3 py-1.5 rounded-xl hover:bg-[#252525] transition-colors group text-left"
                    >
                        <div className="flex items-center gap-3">
                            <item.icon
                                className="w-[18px] h-[18px] text-[#CBCACA] group-hover:text-white transition-colors"
                                strokeWidth={1.5}
                            />
                            <span className="text-[14px] text-[#CBCACA] group-hover:text-white transition-colors">
                                {item.label}
                            </span>
                        </div>
                        {item.shortcut && (
                            <span className="text-[12px] text-[#969593]">{item.shortcut}</span>
                        )}
                        {item.external && (
                            <ExternalLink className="w-[14px] h-[14px] text-[#969593] group-hover:text-[#CBCACA] transition-colors" />
                        )}
                        {item.rightElement && item.rightElement}
                    </button>
                ))}
            </div>

            <div className="h-[1px] bg-[#2B2A29] mx-1 my-1" />

            {/* Sign Out Section */}
            <button
                onClick={() => {
                    onSignOut?.()
                    onClose()
                }}
                className="flex items-center gap-3 w-full px-3 py-1.5 rounded-xl hover:bg-[#252525] transition-colors group text-left mb-0.5"
            >
                <LogOut
                    className="w-[18px] h-[18px] text-[#CBCACA] group-hover:text-white transition-colors"
                    strokeWidth={1.5}
                />
                <span className="text-[14px] text-[#CBCACA] group-hover:text-white transition-colors">
                    Sign out
                </span>
            </button>
        </div>,
        document.body
    )
}
