import React from 'react'

import type { SidebarNavItemProps } from '@/features/navigation/types'

import { cn } from '@/shared/lib/utils'

export const SidebarNavItem: React.FC<
    Omit<SidebarNavItemProps, 'collapsed'> & { collapsed?: boolean }
> = ({ icon, label, active, onClick }) => {
    const isHome = label.toLowerCase() === 'home'
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 px-3 py-[7px] rounded-lg transition-colors group w-full font-sans outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0',
                active
                    ? isHome
                        ? 'bg-transparent text-[#8F8E8D] hover:bg-[#252422] hover:text-[#CBCACA]'
                        : 'bg-[#252422] text-[#CBCACA]'
                    : 'hover:bg-[#252422] text-[#8F8E8D] hover:text-[#CBCACA]'
            )}
        >
            <div
                className={cn(
                    'w-[18px] h-[18px] flex items-center justify-center transition-colors',
                    active && !isHome
                        ? 'text-[#CBCACA]'
                        : 'text-[#8F8E8D] group-hover:text-[#CBCACA]'
                )}
            >
                {icon}
            </div>
            <span
                className={cn(
                    'font-medium text-[14px] whitespace-nowrap transition-colors tracking-tight',
                    active && !isHome
                        ? 'text-[#CBCACA]'
                        : 'text-[#8F8E8D] group-hover:text-[#CBCACA]'
                )}
            >
                {label}
            </span>
        </button>
    )
}
