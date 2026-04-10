import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import type { SidebarFooterProps } from '@/features/navigation/types'

export const SidebarFooter: React.FC<SidebarFooterProps & { user?: { name?: string } }> = ({
    isAuthenticated,
    isCollapsed,
    onProfile,
    onOpenAuth,
    user,
}) => {
    return (
        <div className="mt-auto flex flex-col w-full">
            <div className="w-full border-t border-white/[0.04]"></div>

            <div className="px-3 pt-1 pb-1.5">
                {isAuthenticated ? (
                    <button
                        onClick={onProfile}
                        className="flex items-center gap-3 px-3 py-[7px] rounded-lg hover:bg-white/[0.04] transition-colors group w-full outline-none"
                    >
                        <div className="flex items-center justify-center w-[18px] h-[18px] text-[#D6D5D4] shrink-0">
                            <Icons.UserCircle className="w-[18px] h-[18px]" />
                        </div>
                        <span className="font-medium text-[14px] text-[#D6D5D4] truncate tracking-tight">
                            {user?.name ? user.name.split(' ')[0] : 'User'}
                        </span>
                    </button>
                ) : (
                    <button
                        onClick={onOpenAuth}
                        className="flex items-center justify-center w-full py-[7px] px-3 bg-white/10 text-[#D6D5D4] text-[14px] font-medium rounded-lg hover:bg-white/15 transition-all"
                    >
                        Sign In
                    </button>
                )}
            </div>
        </div>
    )
}
