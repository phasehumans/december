import React, { useState, useRef } from 'react'

import { useQuery } from '@tanstack/react-query'

import { Icons } from '@/shared/components/ui/Icons'
import { profileAPI } from '@/features/profile/api/profile'
import type { SidebarFooterProps } from '@/features/navigation/types'
import { UserProfilePopover } from './UserProfilePopover'

export const SidebarFooter: React.FC<SidebarFooterProps & { user?: { name?: string } }> = ({
    isAuthenticated,
    isCollapsed,
    onProfile,
    onDocs,
    onOpenAuth,
    user,
}) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)
    const anchorRef = useRef<HTMLButtonElement>(null)

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
                        <button
                            ref={anchorRef}
                            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                            className="flex items-center gap-3 px-3 py-[7px] rounded-lg hover:bg-[#252422] transition-colors group w-full outline-none"
                        >
                            <div className="flex items-center justify-center w-[18px] h-[18px] text-[#D6D5D4] shrink-0">
                                <Icons.UserCircle className="w-[18px] h-[18px]" />
                            </div>
                            <span className="font-medium text-[14px] text-[#D6D5D4] truncate tracking-tight">
                                {quickInfo?.firstName || 'Profile'}
                            </span>
                        </button>

                        <UserProfilePopover
                            isOpen={isPopoverOpen}
                            anchorRef={anchorRef}
                            onClose={() => setIsPopoverOpen(false)}
                            userName={profile?.name || quickInfo?.firstName || 'phasehuman'}
                            userEmail={profile?.email || 'dev.chaitanyasonawane@gmail.com'}
                            onProfile={onProfile}
                            onDocs={onDocs}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
