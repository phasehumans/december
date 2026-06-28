import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GitPullRequest } from 'lucide-react'

import { SearchModal } from './SearchModal'
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
    onSessions,
    onReview,
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

    const [isSearchOpen, setIsSearchOpen] = React.useState(false)

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setIsSearchOpen((prev) => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const isHomeActive = path === '/'
    const isProjectsActive = path.startsWith('/projects')
    const isSessionsActive = path.startsWith('/sessions')
    const isReviewActive = path.startsWith('/review')
    const isTemplatesActive = path.startsWith('/templates')
    const isDocsActive = path.startsWith('/docs')
    const isSettingsActive = path.startsWith('/settings')

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
                    icon={<Icons.SessionsIcon className="w-[18px] h-[18px]" />}
                    label="Sessions"
                    active={isSessionsActive}
                    onClick={onSessions}
                />
                <SidebarNavItem
                    icon={<GitPullRequest className="w-[18px] h-[18px]" />}
                    label="Review"
                    active={isReviewActive}
                    onClick={onReview}
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
                    icon={<Icons.Settings className="w-[18px] h-[18px]" />}
                    label="Settings"
                    active={isSettingsActive}
                    onClick={onProfile}
                />
            </div>

            <div className="flex-1 flex flex-col pl-[10px] pr-3 mt-4 mb-2 overflow-y-auto no-scrollbar font-sans">
                <div className="flex flex-col mb-2">
                    <div className="flex items-center justify-between px-3 py-1.5 w-full text-left group">
                        <span className="font-medium text-[13px] whitespace-nowrap transition-colors tracking-tight text-[#919191]">
                            Recent
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="relative text-[#919191] hover:text-[#B5B5B7] transition-all outline-none group/btn"
                            >
                                <Icons.Search className="w-3.5 h-3.5" />
                                <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/btn:flex items-center gap-1.5 bg-[#1C1B1A] border border-[#2A2928] px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                    <span className="text-[12px] font-medium text-[#EDEDEF]">
                                        Search
                                    </span>
                                </div>
                            </button>
                            <button
                                onClick={() => (isAuthenticated ? onNewThread?.() : onOpenAuth?.())}
                                className="relative text-[#919191] hover:text-[#B5B5B7] transition-all outline-none group/btn"
                            >
                                <Icons.Plus className="w-3.5 h-3.5" />
                                <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/btn:flex items-center gap-1.5 bg-[#1C1B1A] border border-[#2A2928] px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                    <span className="text-[12px] font-medium text-[#EDEDEF]">
                                        New
                                    </span>
                                </div>
                            </button>
                            <button
                                type="button"
                                className="relative text-[#919191] hover:text-[#B5B5B7] transition-all outline-none group/btn"
                            >
                                <Icons.MoreHorizontal className="w-3.5 h-3.5" />
                                <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/btn:flex items-center gap-1.5 bg-[#1C1B1A] border border-[#2A2928] px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                    <span className="text-[12px] font-medium text-[#EDEDEF]">
                                        More options
                                    </span>
                                </div>
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
                                        <span className="font-medium text-[12px] lowercase transition-colors tracking-tight text-[#949496] group-hover:text-[#E1E1E2] truncate">
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

            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onNewThread={isAuthenticated ? onNewThread : onOpenAuth}
                isAuthenticated={isAuthenticated}
            />
        </div>
    )
}

export default Sidebar
