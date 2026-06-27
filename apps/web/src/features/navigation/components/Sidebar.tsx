import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { SidebarFooter } from './SidebarFooter'
import { SidebarHeader } from './SidebarHeader'
import { SidebarNavItem } from './SidebarNavItem'

import type { SidebarProps } from '@/features/navigation/types'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

const Sidebar: React.FC<
    SidebarProps & { user?: any; onSignOut?: () => void; onHomeClick?: () => void }
> = ({
    onNewThread,
    onAllProjects,
    onTemplates,
    onDocs,
    onProfile,
    onOpenProject,
    isAuthenticated,
    onOpenAuth,
    projects,
    isProjectsLoading,
    user,
    onSignOut,
    onHomeClick,
}) => {
    const navigate = useNavigate()
    const location = useLocation()
    const path = location.pathname

    const isHomeActive = path === '/'
    const isProjectsActive = path.startsWith('/projects')
    const isTemplatesActive = path.startsWith('/templates')
    const isDocsActive = path.startsWith('/docs')

    // Keep exact same size (was 200px when open)
    // No collapse option

    const { data: overview } = useBillingOverview()
    const isPro = overview?.plan === 'PRO'

    const recentProjects = isAuthenticated
        ? [...projects]
              .sort(
                  (a, b) => new Date(b.rawUpdatedAt).getTime() - new Date(a.rawUpdatedAt).getTime()
              )
              .slice(0, 10)
        : []

    return (
        <div className="hidden md:flex flex-col h-screen bg-sidebar border-r border-white/5 pt-2 pb-0 z-20 w-[200px] font-sans">
            <SidebarHeader
                onNewThread={isAuthenticated ? onNewThread : onOpenAuth}
                onHomeClick={isAuthenticated ? onHomeClick : onOpenAuth}
                isAuthenticated={isAuthenticated}
                onOpenAuth={onOpenAuth}
            />

            <div className="flex flex-col gap-[2px] pl-[10px] pr-3">
                <SidebarNavItem
                    icon={<Icons.Home />}
                    label="Home"
                    active={isHomeActive}
                    onClick={isAuthenticated ? onNewThread : onOpenAuth}
                />
                <SidebarNavItem
                    icon={<Icons.Plus />}
                    label="New Project"
                    onClick={isAuthenticated ? onNewThread : onOpenAuth}
                />
                <SidebarNavItem
                    icon={<Icons.Folder />}
                    label="Projects"
                    active={isProjectsActive}
                    onClick={onAllProjects}
                />
                <SidebarNavItem
                    icon={<Icons.Bookmark />}
                    label="Templates"
                    active={isTemplatesActive}
                    onClick={onTemplates}
                />
                <SidebarNavItem
                    icon={<Icons.DocsBook className="w-[18px] h-[18px]" />}
                    label="Documentation"
                    active={isDocsActive}
                    onClick={onDocs}
                />
            </div>

            <div className="flex-1 flex flex-col pl-[10px] pr-3 mt-4 mb-2 overflow-y-auto no-scrollbar font-sans">
                <div className="mb-3 border-t border-white/5" />

                <div className="flex flex-col mb-2">
                    <div className="flex items-center justify-between px-3 py-1.5 w-full text-left group">
                        <span className="font-medium text-[13px] whitespace-nowrap transition-colors tracking-tight text-[#8F8E8D] group-hover:text-[#CBCACA]">
                            Recent
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() =>
                                    isAuthenticated ? onAllProjects?.() : onOpenAuth?.()
                                }
                                className="text-[#8F8E8D] hover:text-[#D6D5D4] transition-all outline-none"
                                title="Search projects"
                            >
                                <Icons.Search className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                className="text-[#8F8E8D] hover:text-[#D6D5D4] transition-all outline-none"
                            >
                                <Icons.MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-[1px] mt-1 pr-1">
                        {isAuthenticated ? (
                            isProjectsLoading ? null : recentProjects.length > 0 ? (
                                recentProjects.map((project) => (
                                    <button
                                        key={project.id}
                                        onClick={() => onOpenProject?.(project.id)}
                                        className="flex items-center px-3 py-0.5 w-full text-left rounded-lg hover:bg-[#252525] transition-colors group"
                                    >
                                        <span className="font-medium text-[12px] lowercase transition-colors tracking-tight text-[#8F8E8D] group-hover:text-[#CBCACA] truncate">
                                            {/* @ts-expect-error */}
                                            {project.name || project.title}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="px-3 py-1.5 text-[12px] font-medium text-[#6B6A69] tracking-tight">
                                    No recent projects
                                </div>
                            )
                        ) : (
                            <div className="px-3 py-1.5 text-[12px] font-medium text-[#6B6A69] tracking-tight">
                                No recent projects
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <SidebarFooter
                isAuthenticated={isAuthenticated}
                isCollapsed={false}
                onProfile={onProfile}
                onDocs={onDocs}
                onOpenAuth={onOpenAuth}
                user={user}
                onSignOut={onSignOut}
            />
        </div>
    )
}

export default Sidebar
