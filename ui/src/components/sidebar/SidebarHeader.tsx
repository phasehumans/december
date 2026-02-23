import React from 'react'
import { Icons } from '../ui/Icons'
import { Logo } from '../Logo'
import { cn } from '../../lib/utils'

interface SidebarHeaderProps {
    isCollapsed: boolean
    onToggleCollapse: () => void
    onNewThread: () => void
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
    isCollapsed,
    onToggleCollapse,
    onNewThread,
}) => {
    return (
        <div className="px-4 mb-6 flex items-center justify-between min-h-[40px]">
            {!isCollapsed && (
                <div
                    className="animate-in fade-in duration-300 cursor-pointer pl-2"
                    onClick={onNewThread}
                >
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
