import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'
import type { SidebarSectionHeaderProps } from '@/features/navigation/types'

export const SidebarSectionHeader: React.FC<SidebarSectionHeaderProps> = ({
    label,
    icon,
    collapsed,
    isOpen,
    onToggle,
}) => {
    if (collapsed) {
        return (
            <button
                onClick={onToggle}
                className="flex items-center justify-center p-2 rounded-lg hover:bg-surface/50 text-[#91908F] hover:text-[#E8E8E6] w-full group relative transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                title={label}
            >
                <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
            </button>
        )
    }

    return (
        <button
            onClick={onToggle}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-surface/50 text-[#91908F] hover:text-[#E8E8E6] w-full group select-none transition-colors font-sans outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
            <div className="flex items-center gap-3">
                <div className="w-4 h-4 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity text-[#91908F] group-hover:text-[#E8E8E6]">
                    {icon}
                </div>
                <span className="font-medium text-xs uppercase tracking-wider opacity-90">
                    {label}
                </span>
            </div>
            <div
                className={cn(
                    'text-[#91908F] group-hover:text-[#E8E8E6] transition-transform duration-200',
                    isOpen ? 'rotate-0' : '-rotate-90'
                )}
            >
                <Icons.ChevronDown />
            </div>
        </button>
    )
}
