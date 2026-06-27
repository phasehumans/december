import React from 'react'

import type { SidebarProjectItemProps } from '@/features/navigation/types'

export const SidebarProjectItem: React.FC<SidebarProjectItemProps> = ({ id, title, onClick }) => {
    return (
        <button
            onClick={() => onClick(id)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-[#91908F] hover:text-[#E8E8E6] hover:bg-[#252525] transition-colors text-left truncate group font-sans w-full outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0"
        >
            <span className="truncate">{title}</span>
        </button>
    )
}
