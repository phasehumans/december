import React from 'react'
import { Icons } from '@/shared/components/ui/Icons'
import { Logo } from '@/shared/components/Logo'
import { cn } from '@/shared/lib/utils'
import type { SidebarHeaderProps } from '@/features/navigation/types'

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
    isCollapsed,
    onToggleCollapse,
    onNewThread,
}) => {
    return (
        <div className="px-4 mb-6 flex items-center justify-between min-h-[40px]">
            {!isCollapsed && (
                <div className="cursor-pointer pl-2" onClick={onNewThread}>
                    <Logo />
                </div>
            )}
            <button
                onClick={onToggleCollapse}
                className={cn(
                    'text-[#91908F] hover:text-[#E8E8E6] transition-colors p-1.5 rounded-md hover:bg-surfaceHover',
                    isCollapsed ? 'mx-auto' : 'ml-auto'
                )}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                <Icons.SidebarToggle />
            </button>
        </div>
    )
}
