import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import sidebarPng from '../../../../public/sidebar.png'

import { NotificationsPopover } from './NotificationsPopover'
import { UserProfilePopover } from './UserProfilePopover'

import type { SidebarFooterProps } from '@/features/navigation/types'

import { billingAPI } from '@/features/billing/api/billing'
import { notificationAPI } from '@/features/notification/api/notification'
import { profileAPI } from '@/features/profile/api/profile'
import { ProfileCardModal } from '@/features/profile/components/ProfileCardModal'
import { ProfileFeedbackModal } from '@/features/profile/components/ProfileFeedbackModal'
import { Icons } from '@/shared/components/ui/Icons'

export const SidebarFooter: React.FC<
    SidebarFooterProps & { user?: { name?: string }; onSignOut?: () => void }
> = ({ isAuthenticated, isCollapsed, onProfile, onDocs, onOpenAuth, user, onSignOut }) => {
    const navigate = useNavigate()
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)
    const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false)
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
    const [showCliCard, setShowCliCard] = useState(false)
    const anchorRef = useRef<HTMLButtonElement>(null)
    const notifAnchorRef = useRef<HTMLButtonElement>(null)

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

    return (
        <div className="mt-auto flex flex-col w-full relative">
            <div className="px-3 py-1.5 flex justify-center relative">
                <button
                    id="try-cli-btn"
                    onClick={() => setShowCliCard(!showCliCard)}
                    className="upgrade-plan-btn flex items-center gap-1 px-2.5 py-[3px] rounded-full hover:bg-white/[0.06] transition-all text-[#CBCACA] hover:text-white text-[11px] font-medium outline-none w-fit mx-auto cursor-pointer"
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
                        className="absolute bottom-11 left-3 w-[260px] z-[100] bg-[#1C1B1A] border border-[#2A2928] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                    >
                        <div className="w-full h-[165px] bg-[#1C1B1A] relative overflow-hidden flex items-center justify-center p-1.5 pb-0">
                            <div className="w-full h-full relative overflow-hidden rounded-xl border border-[#2A2928]">
                                <img
                                    src={sidebarPng}
                                    alt="December CLI preview"
                                    className="w-full h-full object-cover object-center scale-[1.35] absolute inset-0"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col px-1.5 pt-1.5 pb-2.5 bg-[#1C1B1A]">
                            <button
                                onClick={() => {
                                    setShowCliCard(false)
                                    navigate('/cli')
                                }}
                                className="flex flex-col px-1.5 py-0.5 w-full text-left cursor-pointer outline-none overflow-hidden"
                            >
                                <span className="text-[12px] font-medium text-[#D6D5D4]">
                                    December CLI
                                </span>
                                <span className="text-[11px] text-[#8F8E8D] mt-0.5 leading-tight truncate w-full">
                                    Build apps from your terminal.
                                </span>
                            </button>
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
                                onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                                className="flex items-center gap-2 px-1.5 py-[7px] rounded-lg hover:bg-[#252422] transition-colors group outline-none min-w-0"
                                style={{ maxWidth: 'calc(100% - 28px)' }}
                            >
                                <div className="flex items-center justify-center w-[24px] h-[24px] rounded-full bg-white/[0.04] text-[#8F8E8D] group-hover:text-[#CBCACA] transition-colors shrink-0">
                                    <Icons.UserCircle className="w-[12px] h-[12px]" />
                                </div>
                                <span className="font-medium text-[13px] text-[#8F8E8D] group-hover:text-[#CBCACA] transition-colors truncate tracking-tight text-left">
                                    {user?.name ||
                                        profile?.name ||
                                        quickInfo?.fullName ||
                                        'Profile'}
                                </span>
                            </button>
                            <button
                                ref={notifAnchorRef}
                                onClick={() => setIsNotifPopoverOpen(!isNotifPopoverOpen)}
                                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#252422] text-[#8F8E8D] hover:text-[#CBCACA] transition-colors shrink-0 outline-none -ml-1 relative"
                            >
                                <Bell className="w-[13px] h-[13px]" strokeWidth={2} />
                                {hasUnread && (
                                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-white rounded-full border border-[#171615]" />
                                )}
                            </button>
                        </div>

                        <UserProfilePopover
                            isOpen={isPopoverOpen}
                            anchorRef={anchorRef}
                            onClose={() => setIsPopoverOpen(false)}
                            userName={profile?.name || quickInfo?.fullName || 'phasehuman'}
                            userEmail={profile?.email || 'dev.chaitanyasonawane@gmail.com'}
                            onSettings={onProfile}
                            onProfileModal={() => setIsProfileModalOpen(true)}
                            onFeedbackModal={() => setIsFeedbackModalOpen(true)}
                            onDocs={onDocs}
                            onSignOut={onSignOut}
                        />

                        <NotificationsPopover
                            isOpen={isNotifPopoverOpen}
                            anchorRef={notifAnchorRef}
                            onClose={() => setIsNotifPopoverOpen(false)}
                            onSettings={onProfile}
                        />

                        <ProfileCardModal
                            isOpen={isProfileModalOpen}
                            onClose={() => setIsProfileModalOpen(false)}
                            userName={profile?.name || quickInfo?.fullName || 'phasehuman'}
                            userUsername={profile?.username || ''}
                            onSettings={onProfile}
                        />

                        <ProfileFeedbackModal
                            isOpen={isFeedbackModalOpen}
                            onClose={() => setIsFeedbackModalOpen(false)}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
