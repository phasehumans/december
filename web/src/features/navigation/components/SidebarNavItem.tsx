import React from 'react'
import { cn } from '@/shared/lib/utils'
import type { SidebarNavItemProps } from '@/features/navigation/types'

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
    icon,
    label,
    active,
    collapsed,
    onClick,
}) => (
    <button
        onClick={onClick}
        className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-all group w-full font-sans outline-none focus-visible:ring-2 focus-visible:ring-white/20',
            active
                ? 'bg-surface text-white shadow-sm ring-1 ring-white/5'
                : 'hover:bg-surface/50 text-[#91908F] hover:text-[#E8E8E6]',
            collapsed ? 'justify-center' : ''
        )}
        title={collapsed ? label : undefined}
    >
        <div
            className={cn(
                'w-5 h-5 flex items-center justify-center transition-colors',
                active ? 'text-white' : 'text-[#91908F] group-hover:text-[#E8E8E6]'
            )}
        >
            {icon}
        </div>
        {!collapsed && <span className="font-medium text-sm whitespace-nowrap">{label}</span>}
    </button>
)
