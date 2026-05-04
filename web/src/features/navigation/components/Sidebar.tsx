import React, { useState } from 'react'

import { SidebarNavItem } from './SidebarNavItem'
import { SidebarHeader } from './SidebarHeader'
import { SidebarFooter } from './SidebarFooter'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'
import type { SidebarProps } from '@/features/navigation/types'

const Sidebar: React.FC<SidebarProps & { user?: any }> = ({
    onNewThread,
    onAllProjects,
    onTemplates,
    onDesignSystems,
    onDocs,
    onProfile,
    onOpenProject,
    isAuthenticated,
    onOpenAuth,
    projects,
    isProjectsLoading,
    user,
}) => {
    // Keep exact same size (was 200px when open)
    // No collapse option
    const [recentOpen, setRecentOpen] = useState(true)

    const recentProjects = isAuthenticated ? projects.slice(0, 5) : []

    return (
        <div className="hidden md:flex flex-col h-screen bg-sidebar border-r border-white/5 pt-2 pb-0 z-20 w-[200px] font-sans">
            <SidebarHeader onNewThread={onNewThread} />

            <div className="flex flex-col gap-[2px] pl-[10px] pr-3">
                <SidebarNavItem
                    icon={<Icons.Home />}
                    label="Home"
                    active={false} // Would be set by router
                    onClick={onNewThread}
                />
                <SidebarNavItem
                    icon={<Icons.Plus />}
                    label="New Project"
                    onClick={onNewThread} // Replace with proper action if needed
                />
                <SidebarNavItem icon={<Icons.Grid />} label="Projects" onClick={onAllProjects} />
                <SidebarNavItem icon={<Icons.Layout />} label="Templates" onClick={onTemplates} />
                <SidebarNavItem
                    icon={<Icons.DesignSystems />}
                    label="Design Systems"
                    onClick={onDesignSystems}
                />
                <SidebarNavItem icon={<Icons.DocsBook />} label="Documentation" onClick={onDocs} />
            </div>

            <div className="flex-1 flex flex-col pl-[10px] pr-3 mt-4 mb-2 overflow-y-auto no-scrollbar font-sans">
                <div className="mb-3 border-t border-white/5" />

                <div className="flex flex-col mb-2">
                    <button
                        onClick={() => setRecentOpen(!recentOpen)}
                        className="flex items-center justify-between px-3 py-1.5 w-full text-left group outline-none"
                    >
                        <span className="font-semibold text-[11px] tracking-widest text-[#969593] group-hover:text-[#D6D5D4] uppercase transition-colors">
                            Recent Projects
                        </span>
                        <div
                            className={cn(
                                'text-[#969593] group-hover:text-[#D6D5D4] transition-all opacity-0 group-hover:opacity-100',
                                recentOpen ? 'rotate-0' : '-rotate-90'
                            )}
                        >
                            <Icons.ChevronDown className="w-3 h-3" />
                        </div>
                    </button>

                    {recentOpen && (
                        <div className="flex flex-col gap-[1px] mt-1 pr-1">
                            {isAuthenticated
                                ? isProjectsLoading
                                    ? null
                                    : recentProjects.length > 0
                                      ? recentProjects.map((project) => (
                                            <button
                                                key={project.id}
                                                onClick={() => onOpenProject?.(project.id)}
                                                className="flex items-center px-3 py-0.5 w-full text-left rounded-lg hover:bg-[#252422] transition-colors group"
                                            >
                                                <span className="font-semibold text-[11px] tracking-widest text-[#969593] group-hover:text-[#D6D5D4] lowercase transition-colors truncate">
                                                    {/* @ts-ignore */}
                                                    {project.name || project.title}
                                                </span>
                                            </button>
                                        ))
                                      : null
                                : null}
                        </div>
                    )}
                </div>
            </div>

            <SidebarFooter
                isAuthenticated={isAuthenticated}
                isCollapsed={false}
                onProfile={onProfile}
                onDocs={onDocs}
                onOpenAuth={onOpenAuth}
                user={user}
            />
        </div>
    )
}

export default Sidebar
