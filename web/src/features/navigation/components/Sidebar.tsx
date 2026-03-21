import React, { useState } from 'react'
import { Icons } from '@/shared/components/ui/Icons'
import { SidebarNavItem } from './SidebarNavItem'
import { SidebarHeader } from './SidebarHeader'
import { SidebarFooter } from './SidebarFooter'
import { SidebarProjectsSection } from './SidebarProjectsSection'
import { cn } from '@/shared/lib/utils'
import type { SidebarProps } from '@/features/navigation/types'

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
    const starredProjects = isAuthenticated ? projects.filter((project) => project.isStarred) : []

    return (
        <div
            className={cn(
                "hidden md:flex flex-col h-screen bg-sidebar border-r border-white/5 py-5 z-20 transition-[width] duration-300 ease-out font-['Segoe_UI']",
                isCollapsed ? 'w-[68px]' : 'w-[248px]'
            )}
        >
            <SidebarHeader
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                onNewThread={onNewThread}
            />

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

            <div className="flex-1 flex flex-col gap-2 px-3 mt-6 overflow-y-auto no-scrollbar font-sans">
                <SidebarProjectsSection
                    label="Recent"
                    icon={<Icons.Clock />}
                    collapsed={isCollapsed}
                    isOpen={recentOpen}
                    onToggle={() => setRecentOpen(!recentOpen)}
                    projects={recentProjects}
                    isLoading={isAuthenticated && isProjectsLoading}
                    loadingCount={3}
                    emptyText="No recent projects"
                />

                <SidebarProjectsSection
                    label="Starred"
                    icon={<Icons.Star />}
                    collapsed={isCollapsed}
                    isOpen={starredOpen}
                    onToggle={() => setStarredOpen(!starredOpen)}
                    projects={starredProjects}
                    isLoading={isAuthenticated && isProjectsLoading}
                    loadingCount={2}
                    emptyText="No starred projects"
                />
            </div>

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
