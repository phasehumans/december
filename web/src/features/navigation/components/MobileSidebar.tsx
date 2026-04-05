import React from 'react'

import { SidebarFooter } from './SidebarFooter'
import { SidebarProjectsSection } from './SidebarProjectsSection'
import { MobileSidebarHeader } from './MobileSidebarHeader'
import { MobileSidebarNav } from './MobileSidebarNav'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'
import type { MobileSidebarProps } from '@/features/navigation/types'

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
    isOpen,
    onClose,
    onNewThread,
    onAllProjects,
    onTemplates,
    onProfile,
    onOpenProject,
    isAuthenticated,
    onOpenAuth,
    projects,
    isProjectsLoading,
}) => {
    const [recentOpen, setRecentOpen] = React.useState(true)
    const [starredOpen, setStarredOpen] = React.useState(true)

    const recentProjects = isAuthenticated ? projects.slice(0, 3) : []
    const starredProjects = isAuthenticated ? projects.filter((project) => project.isStarred) : []

    return (
        <>
            <div
                className={cn(
                    'fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ease-out',
                    isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                )}
                onClick={onClose}
            />

            <div
                className={cn(
                    'fixed inset-y-0 left-0 w-[280px] bg-sidebar border-r border-white/5 z-[60] md:hidden flex flex-col py-5 transition-[transform,opacity] duration-300 ease-out will-change-transform',
                    isOpen
                        ? 'translate-x-0 opacity-100 pointer-events-auto'
                        : '-translate-x-full opacity-0 pointer-events-none'
                )}
            >
                <MobileSidebarHeader onClose={onClose} onNewThread={onNewThread} />

                <MobileSidebarNav
                    onClose={onClose}
                    onNewThread={onNewThread}
                    onAllProjects={onAllProjects}
                    onTemplates={onTemplates}
                />

                <div className="flex-1 flex flex-col gap-2 px-3 mt-6 overflow-y-auto no-scrollbar font-sans">
                    <SidebarProjectsSection
                        label="Recent"
                        icon={<Icons.Clock />}
                        collapsed={false}
                        isOpen={recentOpen}
                        onToggle={() => setRecentOpen(!recentOpen)}
                        projects={recentProjects}
                        isLoading={isAuthenticated && isProjectsLoading}
                        loadingCount={3}
                        emptyText="No recent projects"
                        onOpenProject={(projectId) => {
                            onOpenProject(projectId)
                            onClose()
                        }}
                    />

                    <SidebarProjectsSection
                        label="Starred"
                        icon={<Icons.Star />}
                        collapsed={false}
                        isOpen={starredOpen}
                        onToggle={() => setStarredOpen(!starredOpen)}
                        projects={starredProjects}
                        isLoading={isAuthenticated && isProjectsLoading}
                        loadingCount={2}
                        emptyText="No starred projects"
                        onOpenProject={(projectId) => {
                            onOpenProject(projectId)
                            onClose()
                        }}
                    />
                </div>

                <SidebarFooter
                    isAuthenticated={isAuthenticated}
                    isCollapsed={false}
                    onProfile={() => {
                        onProfile()
                        onClose()
                    }}
                    onOpenAuth={() => {
                        onOpenAuth()
                        onClose()
                    }}
                />
            </div>
        </>
    )
}
