import React from 'react'

import { cn } from '@/shared/lib/utils'
import type { SidebarNavItemProps } from '@/features/navigation/types'

export const SidebarNavItem: React.FC<
    Omit<SidebarNavItemProps, 'collapsed'> & { collapsed?: boolean }
> = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            'flex items-center gap-3 px-3 py-[7px] rounded-lg transition-all group w-full font-sans outline-none focus-visible:ring-2 focus-visible:ring-white/20',
            active
                ? 'bg-white/5 text-[#CBCACA]'
                : 'hover:bg-[#252422] text-[#969593] hover:text-[#CBCACA]'
        )}
    >
        <div
            className={cn(
                'w-[18px] h-[18px] flex items-center justify-center transition-colors',
                active ? 'text-[#CBCACA]' : 'text-[#969593] group-hover:text-[#CBCACA]'
            )}
        >
            {icon}
        </div>
        <span
            className={cn(
                'font-medium text-[14px] whitespace-nowrap transition-colors tracking-tight',
                active ? 'text-[#CBCACA]' : 'text-[#969593] group-hover:text-[#CBCACA]'
            )}
        >
            {label}
        </span>
    </button>
)
