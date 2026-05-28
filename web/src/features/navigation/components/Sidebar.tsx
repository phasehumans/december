import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SidebarFooter } from './SidebarFooter'
import { SidebarHeader } from './SidebarHeader'
import { SidebarNavItem } from './SidebarNavItem'

import type { SidebarProps } from '@/features/navigation/types'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

const Sidebar: React.FC<SidebarProps & { user?: any; onSignOut?: () => void }> = ({
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
}) => {
    const navigate = useNavigate()
    // Keep exact same size (was 200px when open)
    // No collapse option
    const [recentOpen, setRecentOpen] = useState(true)

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
            <SidebarHeader onNewThread={onNewThread} />

            <div className="flex flex-col gap-[2px] pl-[10px] pr-3">
                <SidebarNavItem
                    icon={<Icons.Home />}
                    label="Home"
                    active={false} // Would be set by router
                    onClick={onNewThread}
                />
                <SidebarNavItem icon={<Icons.Plus />} label="New Project" onClick={onNewThread} />
                <SidebarNavItem icon={<Icons.Folder />} label="Projects" onClick={onAllProjects} />
                <SidebarNavItem icon={<Icons.Bookmark />} label="Templates" onClick={onTemplates} />
                <SidebarNavItem icon={<Icons.DocsBook />} label="Documentation" onClick={onDocs} />
            </div>

            <div className="flex-1 flex flex-col pl-[10px] pr-3 mt-4 mb-2 overflow-y-auto no-scrollbar font-sans">
                <div className="mb-3 border-t border-white/5" />

                <div className="flex flex-col mb-2">
                    <button
                        onClick={() => setRecentOpen(!recentOpen)}
                        className="flex items-center justify-between px-3 py-1.5 w-full text-left group outline-none"
                    >
                        <span className="font-medium text-[13px] whitespace-nowrap transition-colors tracking-tight text-[#8F8E8D] group-hover:text-[#CBCACA]">
                            Recent Projects
                        </span>
                        <div
                            className={cn(
                                'text-[#8F8E8D] group-hover:text-[#D6D5D4] transition-all opacity-0 group-hover:opacity-100',
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
                                                <span className="font-medium text-[12px] lowercase transition-colors tracking-tight text-[#8F8E8D] group-hover:text-[#CBCACA] truncate">
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

            {isAuthenticated && !isPro && (
                <div className="px-[10px] mb-2 flex justify-center">
                    <button
                        onClick={() => navigate('/profile/billing')}
                        className="flex items-center justify-center gap-1.2 px-2.5 py-[3.5px] rounded-full border border-white/10 bg-transparent text-[#CAC9C9] text-[11px] font-medium hover:bg-white/[0.04] hover:border-white/20 hover:text-white transition-all duration-200"
                    >
                        <svg
                            className="w-[11px] h-[11px] shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="16 12 12 8 8 12" />
                            <line x1="12" y1="16" x2="12" y2="8" />
                        </svg>
                        Upgrade plan
                    </button>
                </div>
            )}

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
