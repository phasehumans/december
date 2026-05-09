import React, { useState, useRef } from 'react'

import { useQuery } from '@tanstack/react-query'

import { Icons } from '@/shared/components/ui/Icons'
import { profileAPI } from '@/features/profile/api/profile'
import type { SidebarFooterProps } from '@/features/navigation/types'
import { UserProfilePopover } from './UserProfilePopover'
import { NotificationsPopover } from './NotificationsPopover'
import { ProfileCardModal } from '@/features/profile/components/ProfileCardModal'
import { ProfileFeedbackModal } from '@/features/profile/components/ProfileFeedbackModal'
import { Bell } from 'lucide-react'

export const SidebarFooter: React.FC<
    SidebarFooterProps & { user?: { name?: string }; onSignOut?: () => void }
> = ({ isAuthenticated, isCollapsed, onProfile, onDocs, onOpenAuth, user, onSignOut }) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)
    const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false)
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
    const anchorRef = useRef<HTMLButtonElement>(null)
    const notifAnchorRef = useRef<HTMLButtonElement>(null)

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

    return (
        <div className="mt-auto flex flex-col w-full">
            <div className="w-full border-t border-white/[0.04]"></div>

            <div className="pl-[10px] pr-3 pt-1 pb-1.5">
                {isAuthenticated && (
                    <>
                        <div className="flex items-center gap-[2px] w-full">
                            <button
                                ref={anchorRef}
                                onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                                className="flex-1 flex items-center gap-3 px-3 py-[7px] rounded-lg hover:bg-[#252422] transition-colors group outline-none min-w-0"
                            >
                                <div className="flex items-center justify-center w-[28px] h-[28px] rounded-full bg-white/[0.04] text-[#8F8E8D] shrink-0">
                                    <Icons.UserCircle className="w-[12px] h-[12px]" />
                                </div>
                                <span className="font-medium text-[14px] text-[#CAC9C9] truncate tracking-tight text-left w-full">
                                    {user?.name ||
                                        profile?.name ||
                                        quickInfo?.name ||
                                        quickInfo?.firstName ||
                                        'Profile'}
                                </span>
                            </button>
                            <button
                                ref={notifAnchorRef}
                                onClick={() => setIsNotifPopoverOpen(!isNotifPopoverOpen)}
                                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#252422] text-[#8F8E8D] hover:text-[#CBCACA] transition-colors shrink-0 outline-none"
                            >
                                <Bell className="w-[14px] h-[14px]" strokeWidth={2} />
                            </button>
                        </div>

                        <UserProfilePopover
                            isOpen={isPopoverOpen}
                            anchorRef={anchorRef}
                            onClose={() => setIsPopoverOpen(false)}
                            userName={profile?.name || quickInfo?.firstName || 'phasehuman'}
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
                            userName={profile?.name || quickInfo?.firstName || 'phasehuman'}
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
