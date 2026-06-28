import React from 'react'

import type { SidebarNavItemProps } from '@/features/navigation/types'

import { cn } from '@/shared/lib/utils'

export const SidebarNavItem: React.FC<
    Omit<SidebarNavItemProps, 'collapsed'> & { collapsed?: boolean; shortcut?: string }
> = ({ icon, label, active, onClick, shortcut }) => {
    const isSearch = label.toLowerCase() === 'search'
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center justify-between gap-2 px-3 py-[7px] rounded-lg transition-colors group w-full font-sans outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0',
                active
                    ? isSearch
                        ? 'bg-transparent text-[#8F8E8D] hover:bg-[#252525] hover:text-[#CBCACA]'
                        : 'bg-[#252525] text-[#CBCACA]'
                    : 'hover:bg-[#252525] text-[#8F8E8D] hover:text-[#CBCACA]'
            )}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                    className={cn(
                        'w-[18px] h-[18px] flex items-center justify-center transition-colors shrink-0',
                        active && !isSearch
                            ? 'text-[#CBCACA]'
                            : 'text-[#8F8E8D] group-hover:text-[#CBCACA]'
                    )}
                >
                    {icon}
                </div>
                <span
                    className={cn(
                        'font-medium text-[14px] whitespace-nowrap transition-colors tracking-tight truncate',
                        active && !isSearch
                            ? 'text-[#CBCACA]'
                            : 'text-[#8F8E8D] group-hover:text-[#CBCACA]'
                    )}
                >
                    {label}
                </span>
            </div>
            {shortcut && (
                <kbd className="hidden md:inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-medium text-[#7B7A79] bg-white/[0.04] border border-white/[0.06] rounded-[4px] group-hover:bg-white/[0.08] group-hover:text-[#CBCACA] transition-all shrink-0">
                    {shortcut}
                </kbd>
            )}
        </button>
    )
}
