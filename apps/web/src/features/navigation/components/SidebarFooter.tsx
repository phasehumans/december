import { useQuery } from '@tanstack/react-query'
import { Inbox, Copy, Check, ChevronRight } from 'lucide-react'
import React, { useState, useRef } from 'react'

import sidebarPng from '../../../../public/sidebar.png'

import { NotificationsPopover } from './NotificationsPopover'

import type { SidebarFooterProps } from '@/features/navigation/types'

import { billingAPI } from '@/features/billing/api/billing'
import { notificationAPI } from '@/features/notification/api/notification'
import { profileAPI } from '@/features/profile/api/profile'
import { Icons } from '@/shared/components/ui/Icons'

export const SidebarFooter: React.FC<
    SidebarFooterProps & { user?: { name?: string }; onSignOut?: () => void }
> = ({ isAuthenticated, isCollapsed, onProfile, onDocs, onOpenAuth, user, onSignOut }) => {
    const [isPopoverOpen] = useState(false)
    const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false)
    const [showCliCard, setShowCliCard] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const anchorRef = useRef<HTMLButtonElement>(null)
    const notifAnchorRef = useRef<HTMLButtonElement>(null)
    const hideTimeoutRef = useRef<any>(null)

    React.useEffect(() => {
        const handler = () => setShowCliCard((prev) => !prev)
        window.addEventListener('open-cli-card', handler)
        return () => window.removeEventListener('open-cli-card', handler)
    }, [])

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const el = document.getElementById('cli-popover-card')
            const btn = document.getElementById('try-cli-btn')
            if (el && !el.contains(e.target as Node) && btn && !btn.contains(e.target as Node)) {
                setShowCliCard(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const { data: quickInfo } = useQuery({
        queryKey: ['quickinfo'],
        queryFn: profileAPI.getQuickInfo,
        enabled: isAuthenticated,
    })

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: isAuthenticated && isPopoverOpen,
    })

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: notificationAPI.getNotifications,
        enabled: isAuthenticated,
        refetchInterval: 30 * 1000,
    })

    const { data: overview } = useQuery({
        queryKey: ['billing-overview'],
        queryFn: billingAPI.getOverview,
        staleTime: 10 * 1000,
        enabled: isAuthenticated,
    })
    const isPro = overview?.plan === 'PRO'
    const hasUnread = notifications.some((n: any) => !n.isRead)

    const handleMouseEnter = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = null
        }
        setShowCliCard(true)
    }

    const handleMouseLeave = () => {
        hideTimeoutRef.current = setTimeout(() => {
            setShowCliCard(false)
            hideTimeoutRef.current = null
        }, 300)
    }

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText('bun install -g @trydecember/cli')
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div className="mt-auto flex flex-col w-full relative">
            <div
                className="px-3 py-1.5 flex justify-center relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <button
                    id="try-cli-btn"
                    onClick={() => setShowCliCard(!showCliCard)}
                    className="upgrade-plan-btn flex items-center gap-1 px-2.5 py-[3px] rounded-full bg-transparent hover:bg-white/5 transition-all text-[#CBCACA] hover:text-white text-[11px] font-medium outline-none w-fit mx-auto cursor-pointer"
                    style={{
                        border: '1px solid #383735',
                    }}
                >
                    <span className="text-[12px]">✱</span>
                    <span>Try December CLI</span>
                </button>

                {showCliCard && (
                    <div
                        id="cli-popover-card"
                        className="absolute bottom-11 left-3 w-[300px] z-[100] bg-[#1E1E1E] border border-[#2A2928] rounded-2xl shadow-lg shadow-black/40 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                    >
                        <div className="w-full h-[165px] bg-[#1E1E1E] relative overflow-hidden flex items-center justify-center p-1.5 pb-0 pointer-events-none">
                            <div className="w-full h-full relative overflow-hidden rounded-xl border border-[#2A2928]">
                                <img
                                    src={sidebarPng}
                                    alt="December CLI preview"
                                    className="w-full h-full object-cover object-center scale-[1.35] absolute inset-0"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col px-2 pt-2 pb-3 bg-[#1E1E1E] gap-2.5">
                            <div className="flex flex-col px-1 w-full text-left overflow-hidden pointer-events-none">
                                <span className="text-[13px] font-medium text-[#D6D5D4]">
                                    December CLI
                                </span>
                                <span className="text-[11px] text-[#8F8E8D] mt-0.5 leading-tight truncate w-full">
                                    Turn ideas into reality.
                                </span>
                            </div>
                            <div className="flex items-center justify-between mx-1 px-3 py-1.5 bg-[#1E1E1E] border border-[#2A2928] rounded-xl group/cmd">
                                <div className="flex items-center truncate mr-2">
                                    <span className="text-[#7B7A79] mr-2 text-[11px] font-mono select-none">
                                        $
                                    </span>
                                    <span className="text-[#D6D5C9] text-[11px] font-mono truncate tracking-tight">
                                        bun install -g @trydecember/cli
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="text-[#7B7A79] hover:text-[#D6D5C9] transition-colors p-1 rounded-md hover:bg-[#2A2928] outline-none shrink-0 cursor-pointer"
                                    title="Copy command"
                                >
                                    {isCopied ? (
                                        <Check className="w-3.5 h-3.5 text-[#87B2F4]" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {isAuthenticated && <div className="w-full border-t border-white/[0.04]"></div>}
            <div className="pl-[6px] pr-[6px] pt-1 pb-1.5">
                {isAuthenticated && (
                    <>
                        <div className="flex items-center gap-0 w-full justify-between">
                            <button
                                ref={anchorRef}
                                onClick={onProfile}
                                className="flex items-center gap-2 px-1.5 py-[7px] rounded-lg hover:bg-[#252525] transition-colors group outline-none min-w-0"
                                style={{ maxWidth: 'calc(100% - 28px)' }}
                            >
                                <div className="flex items-center justify-center w-[24px] h-[24px] rounded-full bg-[#84AEEB]/20 text-[#84AEEB] transition-colors shrink-0 border border-[#84AEEB]/30">
                                    <Icons.UserCircle className="w-[12px] h-[12px]" />
                                </div>
                                <span className="font-medium text-[13px] text-[#E8E8E8] group-hover:text-[#E8E8E8] transition-colors truncate tracking-tight text-left">
                                    {user?.name ||
                                        profile?.name ||
                                        quickInfo?.fullName ||
                                        'Profile'}
                                </span>
                            </button>
                            <button
                                ref={notifAnchorRef}
                                onClick={() => setIsNotifPopoverOpen(!isNotifPopoverOpen)}
                                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#252525] text-[#E8E8E8] hover:text-[#E8E8E8] transition-colors shrink-0 outline-none -ml-1 relative group/notif"
                            >
                                <Inbox className="w-[13px] h-[13px]" strokeWidth={2} />
                                {hasUnread && (
                                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-white rounded-full border border-[#141414]" />
                                )}
                                {!isNotifPopoverOpen && (
                                    <div className="absolute bottom-[calc(100%+6px)] right-0 z-50 hidden group-hover/notif:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                        <span className="text-[12px] font-medium text-[#EDEDEF]">
                                            Notifications
                                        </span>
                                    </div>
                                )}
                            </button>
                        </div>

                        <NotificationsPopover
                            isOpen={isNotifPopoverOpen}
                            anchorRef={notifAnchorRef}
                            onClose={() => setIsNotifPopoverOpen(false)}
                            onSettings={onProfile}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
