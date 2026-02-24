import React, { useState } from 'react'
import { Icons } from './ui/Icons'
import { SidebarNavItem } from './sidebar/SidebarNavItem'
import { SidebarSectionHeader } from './sidebar/SidebarSectionHeader'
import { SidebarProjectItem } from './sidebar/SidebarProjectItem'
import { SidebarHeader } from './sidebar/SidebarHeader'
import { SidebarFooter } from './sidebar/SidebarFooter'
import { cn } from '../lib/utils'
import type { Project } from '../types'

interface SidebarProps {
    onNewThread: () => void
    onAllProjects: () => void
    onProfile: () => void
    isAuthenticated: boolean
    onOpenAuth: () => void
    projects: Project[]
}

const Sidebar: React.FC<SidebarProps> = ({
    onNewThread,
    onAllProjects,
    onProfile,
    isAuthenticated,
    onOpenAuth,
    projects,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [recentOpen, setRecentOpen] = useState(true)
    const [starredOpen, setStarredOpen] = useState(true)

    const recentProjects = isAuthenticated ? projects.slice(0, 3) : []
    const starredProjects = isAuthenticated ? projects.filter((p) => p.isStarred) : []

    return (
        <div
            className={cn(
                "hidden md:flex flex-col h-screen bg-sidebar border-r border-white/5 py-5 z-20 transition-all duration-300 ease-in-out font-['Segoe_UI']",
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
                        <div className="flex flex-col gap-0.5 ml-4 pl-3 border-l border-white/10 mt-1 animate-in slide-in-from-top-2 duration-200">
                            {recentProjects.length > 0 ? (
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
                        <div className="flex flex-col gap-0.5 ml-4 pl-3 border-l border-white/10 mt-1 animate-in slide-in-from-top-2 duration-200">
                            {starredProjects.length > 0 ? (
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
