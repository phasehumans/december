import React from 'react'
import { Icons } from './ui/Icons'
import { Logo } from './Logo'
import { SidebarNavItem } from './sidebar/SidebarNavItem'
import { SidebarSectionHeader } from './sidebar/SidebarSectionHeader'
import { SidebarProjectItem } from './sidebar/SidebarProjectItem'
import { SidebarFooter } from './sidebar/SidebarFooter'
import { cn } from '../lib/utils'
import type { Project } from '../types'

interface MobileSidebarProps {
    isOpen: boolean
    onClose: () => void
    onNewThread: () => void
    onAllProjects: () => void
    onProfile: () => void
    isAuthenticated: boolean
    onOpenAuth: () => void
    projects: Project[]
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
    isOpen,
    onClose,
    onNewThread,
    onAllProjects,
    onProfile,
    isAuthenticated,
    onOpenAuth,
    projects,
}) => {
    const [recentOpen, setRecentOpen] = React.useState(true)
    const [starredOpen, setStarredOpen] = React.useState(true)

    const recentProjects = isAuthenticated ? projects.slice(0, 3) : []
    const starredProjects = isAuthenticated ? projects.filter((p) => p.isStarred) : []

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    'fixed inset-y-0 left-0 w-[280px] bg-sidebar border-r border-white/5 z-[60] transform transition-transform duration-300 ease-in-out md:hidden flex flex-col py-5',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Header */}
                <div className="px-4 mb-6 flex items-center justify-between min-h-[40px]">
                    <div
                        className="animate-in fade-in duration-300 cursor-pointer pl-2"
                        onClick={() => {
                            onNewThread()
                            onClose()
                        }}
                    >
                        <Logo />
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#91908F] hover:text-[#E8E8E6] transition-colors p-1.5 rounded-md hover:bg-surfaceHover"
                    >
                        <Icons.X size={20} />
                    </button>
                </div>

                {/* Main Nav */}
                <div className="flex flex-col gap-1 px-3">
                    <SidebarNavItem
                        icon={<Icons.Home />}
                        label="Home"
                        collapsed={false}
                        onClick={() => {
                            onNewThread()
                            onClose()
                        }}
                    />
                    <SidebarNavItem
                        icon={<Icons.NewProject />}
                        label="New Project"
                        collapsed={false}
                        onClick={() => {
                            onNewThread()
                            onClose()
                        }}
                    />
                    <SidebarNavItem
                        icon={<Icons.Folder />}
                        label="All Projects"
                        collapsed={false}
                        onClick={() => {
                            onAllProjects()
                            onClose()
                        }}
                    />
                </div>

                {/* Sections */}
                <div className="flex-1 flex flex-col gap-2 px-3 mt-6 overflow-y-auto no-scrollbar font-sans">
                    {/* Recent */}
                    <div className="flex flex-col gap-1">
                        <SidebarSectionHeader
                            label="Recent"
                            icon={<Icons.Clock />}
                            collapsed={false}
                            isOpen={recentOpen}
                            onToggle={() => setRecentOpen(!recentOpen)}
                        />
                        {recentOpen && (
                            <div className="flex flex-col gap-0.5 ml-4 pl-3 border-l border-white/10 mt-1">
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
                            collapsed={false}
                            isOpen={starredOpen}
                            onToggle={() => setStarredOpen(!starredOpen)}
                        />
                        {starredOpen && (
                            <div className="flex flex-col gap-0.5 ml-4 pl-3 border-l border-white/10 mt-1">
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
