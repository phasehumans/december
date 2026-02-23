import React from 'react'
import { cn } from '../../lib/utils'

interface SidebarProjectItemProps {
    id: string
    title: string
    onClick?: () => void
}

export const SidebarProjectItem: React.FC<SidebarProjectItemProps> = ({ title, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-[#91908F] hover:text-[#E8E8E6] hover:bg-surface/50 transition-colors text-left truncate group font-sans w-full outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
            <span className="truncate">{title}</span>
        </button>
    )
}
