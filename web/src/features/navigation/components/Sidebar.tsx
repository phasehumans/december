import React, { useState } from 'react'
import { Icons } from '@/shared/components/ui/Icons'
import { SidebarNavItem } from './SidebarNavItem'
import { SidebarSectionHeader } from './SidebarSectionHeader'
import { SidebarProjectItem } from './SidebarProjectItem'
import { SidebarHeader } from './SidebarHeader'
import { SidebarFooter } from './SidebarFooter'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { cn } from '@/shared/lib/utils'
import type { Project } from '@/features/projects/types'
import type { SidebarProps } from '@/features/navigation/types'

const SidebarProjectSkeleton = () => {
    return <Skeleton className="h-6 w-full rounded-md" />
}

const Sidebar: React.FC<SidebarProps> = ({
    onNewThread,
    onAllProjects,
    onProfile,
    isAuthenticated,
    onOpenAuth,
    projects,
    isProjectsLoading,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [recentOpen, setRecentOpen] = useState(true)
    const [starredOpen, setStarredOpen] = useState(true)

    const recentProjects = isAuthenticated ? projects.slice(0, 3) : []
    const starredProjects = isAuthenticated ? projects.filter((p) => p.isStarred) : []

    return (
        <div
            className={cn(
                "hidden md:flex flex-col h-screen bg-sidebar border-r border-white/5 py-5 z-20 transition-[width] duration-300 ease-out font-['Segoe_UI']",
                isCollapsed ? 'w-[72px]' : 'w-[260px]'
            )}
        >
            {/* Header */}
            <SidebarHeader
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                onNewThread={onNewThread}
            />

            {/* Main Nav */}
            <div className="flex flex-col gap-1 px-3">
                <SidebarNavItem
                    icon={<Icons.Home />}
                    label="Home"
                    collapsed={isCollapsed}
                    onClick={onNewThread}
                />
                <SidebarNavItem
                    icon={<Icons.NewProject />}
                    label="New Project"
                    collapsed={isCollapsed}
                    onClick={onNewThread}
                />
                <SidebarNavItem
                    icon={<Icons.Folder />}
                    label="All Projects"
                    collapsed={isCollapsed}
                    onClick={onAllProjects}
                />
            </div>

            {/* Sections */}
            <div className="flex-1 flex flex-col gap-2 px-3 mt-6 overflow-y-auto no-scrollbar font-sans">
                {/* Recent */}
                <div className="flex flex-col gap-1">
                    <SidebarSectionHeader
                        label="Recent"
                        icon={<Icons.Clock />}
                        collapsed={isCollapsed}
                        isOpen={recentOpen}
                        onToggle={() => setRecentOpen(!recentOpen)}
                    />
                    {!isCollapsed && recentOpen && (
                        <div className="flex flex-col gap-1 ml-4 pl-3 border-l border-white/10 mt-1 min-h-[84px]">
                            {isAuthenticated && isProjectsLoading ? (
                                Array.from({ length: 3 }).map((_, index) => (
                                    <SidebarProjectSkeleton key={`recent-skeleton-${index}`} />
                                ))
                            ) : recentProjects.length > 0 ? (
                                recentProjects.map((project) => (
                                    <SidebarProjectItem key={project.id} {...project} />
                                ))
                            ) : (
                                <div className="px-2 py-1.5 text-[13px] text-[#91908F]/50 italic font-['Segoe_UI']">
                                    No recent projects
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Starred */}
                <div className="flex flex-col gap-1">
                    <SidebarSectionHeader
                        label="Starred"
                        icon={<Icons.Star />}
                        collapsed={isCollapsed}
                        isOpen={starredOpen}
                        onToggle={() => setStarredOpen(!starredOpen)}
                    />
                    {!isCollapsed && starredOpen && (
                        <div className="flex flex-col gap-1 ml-4 pl-3 border-l border-white/10 mt-1 min-h-[84px]">
                            {isAuthenticated && isProjectsLoading ? (
                                Array.from({ length: 2 }).map((_, index) => (
                                    <SidebarProjectSkeleton key={`starred-skeleton-${index}`} />
                                ))
                            ) : starredProjects.length > 0 ? (
                                starredProjects.map((project) => (
                                    <SidebarProjectItem key={project.id} {...project} />
                                ))
                            ) : (
                                <div className="px-2 py-1.5 text-[13px] text-[#91908F]/50 italic font-['Segoe_UI']">
                                    No starred projects
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Profile */}
            <SidebarFooter
                isAuthenticated={isAuthenticated}
                isCollapsed={isCollapsed}
                onProfile={onProfile}
                onOpenAuth={onOpenAuth}
            />
        </div>
    )
}

export default Sidebar


