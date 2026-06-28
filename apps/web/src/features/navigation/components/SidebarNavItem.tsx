import React from 'react'

import type { SidebarNavItemProps } from '@/features/navigation/types'

import { cn } from '@/shared/lib/utils'

export const SidebarNavItem: React.FC<
    Omit<SidebarNavItemProps, 'collapsed'> & {
        collapsed?: boolean
        shortcut?: string
        tooltipLabel?: string
        tooltipShortcut?: string[]
    }
> = ({ icon, label, active, onClick, shortcut, tooltipLabel, tooltipShortcut }) => {
    const isSearch = label.toLowerCase() === 'search'
    return (
        <button
            onClick={onClick}
            className={cn(
                'relative flex items-center justify-between gap-2 px-3 py-[7px] rounded-lg transition-colors group w-full font-sans outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0',
                active
                    ? isSearch
                        ? 'bg-transparent text-[#A6A6A8] hover:bg-[#252525] hover:text-[#EDEDEF]'
                        : 'bg-[#252525] text-[#EDEDEF]'
                    : 'hover:bg-[#252525] text-[#A6A6A8] hover:text-[#EDEDEF]'
            )}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                    className={cn(
                        'w-[18px] h-[18px] flex items-center justify-center transition-colors shrink-0',
                        active && !isSearch
                            ? 'text-[#EDEDEF]'
                            : 'text-[#A6A6A8] group-hover:text-[#EDEDEF]'
                    )}
                >
                    {icon}
                </div>
                <span
                    className={cn(
                        'font-medium text-[14px] whitespace-nowrap transition-colors tracking-tight truncate',
                        active && !isSearch
                            ? 'text-[#EDEDEF]'
                            : 'text-[#A6A6A8] group-hover:text-[#EDEDEF]'
                    )}
                >
                    {label}
                </span>
            </div>
            {shortcut && (
                <kbd className="hidden md:inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-medium text-[#7B7A79] bg-white/[0.04] border border-white/[0.06] rounded-[4px] group-hover:bg-white/[0.08] group-hover:text-[#EDEDEF] transition-all shrink-0">
                    {shortcut}
                </kbd>
            )}

            {/* Premium Tooltip */}
            {tooltipLabel && (
                <div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-50 hidden group-hover:flex items-center gap-1.5 bg-[#1C1B1A] border border-[#2A2928] px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                    <span className="text-[12px] font-medium text-[#EDEDEF]">{tooltipLabel}</span>
                    {tooltipShortcut && tooltipShortcut.length > 0 && (
                        <div className="flex items-center gap-1">
                            {tooltipShortcut.map((key, idx) => (
                                <kbd
                                    key={idx}
                                    className="px-1.5 py-0.5 text-[11px] font-medium text-[#A6A6A8] bg-[#292827] border border-[#3A3938] rounded-[4px] shadow-sm leading-none font-sans"
                                >
                                    {key}
                                </kbd>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </button>
    )
}
