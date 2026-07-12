import React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/utils'
import { useNavigate, useLocation } from 'react-router-dom'

import { SearchModal } from './SearchModal'
import { SidebarFooter } from './SidebarFooter'
import { SidebarHeader } from './SidebarHeader'
import { SidebarNavItem } from './SidebarNavItem'

import type { SidebarProps } from '@/features/navigation/types'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { SettingsBigModal } from '@/features/preview/components/settings/SettingsBigModal'
import { Icons } from '@/shared/components/ui/Icons'
import { useProjects } from '@/features/projects/hooks/useProjects'

const Sidebar: React.FC<
    SidebarProps & {
        user?: any
        onSignOut?: () => void
        onHomeClick?: () => void
        onCollapse?: () => void
        isCollapsed?: boolean
        onExpand?: () => void
    }
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
    user,
    onSignOut,
    onHomeClick,
    onCollapse,
    isCollapsed,
    onExpand,
}) => {
    const { data: projects = [], isLoading: isProjectsLoading } = useProjects()
    const navigate = useNavigate()
    const location = useLocation()
    const path = location.pathname

    const [isSearchOpen, setIsSearchOpen] = React.useState(false)
    const [isRecentMenuOpen, setIsRecentMenuOpen] = React.useState(false)
    const [settingsProjectId, setSettingsProjectId] = React.useState<string | null>(null)
    const [recentMenuPos, setRecentMenuPos] = React.useState<{ top: number; left: number } | null>(
        null
    )
    const [sortBy, setSortBy] = React.useState<'created' | 'updated'>('updated')
    const recentMenuRef = React.useRef<HTMLDivElement | null>(null)
    const recentMenuTriggerRef = React.useRef<HTMLButtonElement | null>(null)

    React.useEffect(() => {
        if (!isRecentMenuOpen) return
        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node | null
            if (
                recentMenuRef.current &&
                !recentMenuRef.current.contains(target) &&
                recentMenuTriggerRef.current &&
                !recentMenuTriggerRef.current.contains(target)
            ) {
                setIsRecentMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleOutsideClick)
        document.addEventListener('touchstart', handleOutsideClick)
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick)
            document.removeEventListener('touchstart', handleOutsideClick)
        }
    }, [isRecentMenuOpen])

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
              .sort((a, b) =>
                  sortBy === 'created'
                      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      : new Date(b.rawUpdatedAt).getTime() - new Date(a.rawUpdatedAt).getTime()
              )
              .slice(0, 10)
        : []

    return (
        <div
            className={cn(
                'hidden md:flex flex-col h-screen bg-sidebar border-r border-white/5 pt-2 pb-0 z-20 font-sans transition-all duration-300',
                isCollapsed ? 'w-[56px] items-center' : 'w-[200px]'
            )}
        >
            <SidebarHeader
                onNewThread={isAuthenticated ? onNewThread : onOpenAuth}
                onHomeClick={isAuthenticated ? onHomeClick : onOpenAuth}
                isAuthenticated={isAuthenticated}
                onOpenAuth={onOpenAuth}
                onCollapse={onCollapse}
                isCollapsed={isCollapsed}
                onExpand={onExpand}
            />

            <div className={cn('flex flex-col gap-[1px]', isCollapsed ? 'px-2' : 'pl-[10px] pr-3')}>
                <SidebarNavItem
                    icon={<Icons.SessionsIcon className="w-[18px] h-[18px]" />}
                    label="Sessions"
                    active={isSessionsActive}
                    onClick={onSessions}
                    collapsed={isCollapsed}
                    tooltipLabel={isCollapsed ? 'Sessions' : undefined}
                />
                <SidebarNavItem
                    icon={<Icons.GitPullRequest className="w-[18px] h-[18px]" />}
                    label="Review"
                    active={isReviewActive}
                    onClick={onReview}
                    collapsed={isCollapsed}
                    tooltipLabel={isCollapsed ? 'Review' : undefined}
                />
                <SidebarNavItem
                    icon={<Icons.Folder />}
                    label="Projects"
                    active={isProjectsActive}
                    onClick={onAllProjects}
                    collapsed={isCollapsed}
                    tooltipLabel={isCollapsed ? 'Projects' : undefined}
                />
                <SidebarNavItem
                    icon={<Icons.Bookmark />}
                    label="Templates"
                    active={isTemplatesActive}
                    onClick={onTemplates}
                    collapsed={isCollapsed}
                    tooltipLabel={isCollapsed ? 'Templates' : undefined}
                />
                <SidebarNavItem
                    icon={<Icons.Settings className="w-[18px] h-[18px]" />}
                    label="Settings"
                    active={isSettingsActive}
                    onClick={onProfile}
                    collapsed={isCollapsed}
                    tooltipLabel={isCollapsed ? 'Settings' : undefined}
                />
            </div>

            <div
                className={cn(
                    'flex-1 flex flex-col mt-4 mb-2 overflow-y-auto no-scrollbar font-sans',
                    isCollapsed ? 'px-2 hidden' : 'pl-[10px] pr-3'
                )}
            >
                <div className="flex flex-col mb-2">
                    <div className="flex items-center justify-between px-3 py-1.5 w-full text-left group">
                        <span className="font-normal text-[13px] whitespace-nowrap transition-colors tracking-tight text-[#919191]">
                            Recent
                        </span>
                        <div className="flex items-center gap-0.5">
                            <button
                                onClick={() => (isAuthenticated ? onNewThread() : onOpenAuth?.())}
                                className="relative flex items-center justify-center p-1 rounded-md text-[#919191] hover:text-[#E8E8E8] hover:bg-[#252525] transition-all outline-none group/btn"
                            >
                                <Icons.Plus className="w-3.5 h-3.5" />
                                <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/btn:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                    <span className="text-[12px] font-medium text-[#EDEDEF]">
                                        New project
                                    </span>
                                </div>
                            </button>
                            <button
                                onClick={() =>
                                    isAuthenticated ? setIsSearchOpen(true) : onOpenAuth?.()
                                }
                                className="relative flex items-center justify-center p-1 rounded-md text-[#919191] hover:text-[#E8E8E8] hover:bg-[#252525] transition-all outline-none group/btn"
                            >
                                <Icons.Search className="w-3.5 h-3.5" />
                                <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/btn:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                    <span className="text-[12px] font-medium text-[#EDEDEF]">
                                        Search
                                    </span>
                                </div>
                            </button>
                            <div className="relative">
                                <button
                                    ref={recentMenuTriggerRef}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (!isAuthenticated) {
                                            onOpenAuth?.()
                                        } else {
                                            if (!isRecentMenuOpen) {
                                                const rect = e.currentTarget.getBoundingClientRect()
                                                setRecentMenuPos({
                                                    top: rect.top,
                                                    left: rect.right + 8,
                                                })
                                            }
                                            setIsRecentMenuOpen(!isRecentMenuOpen)
                                        }
                                    }}
                                    className="relative flex items-center justify-center p-1 rounded-md text-[#919191] hover:text-[#E8E8E8] hover:bg-[#252525] transition-all outline-none group/btn"
                                >
                                    <Icons.MoreHorizontal className="w-3.5 h-3.5" />
                                    <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/btn:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                        <span className="text-[12px] font-medium text-[#EDEDEF]">
                                            More options
                                        </span>
                                    </div>
                                </button>
                                {isRecentMenuOpen &&
                                    recentMenuPos &&
                                    typeof document !== 'undefined' &&
                                    createPortal(
                                        <div
                                            ref={recentMenuRef}
                                            className="fixed z-[200] w-[160px] rounded-2xl border border-[#2E2D2C] bg-[#1E1E1E] shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 font-sans text-left"
                                            style={{
                                                top: recentMenuPos.top,
                                                left: recentMenuPos.left,
                                            }}
                                        >
                                            <div className="px-3 py-1 text-[12px] font-medium text-[#8F8E8D]">
                                                Sort by
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSortBy('created')
                                                    setIsRecentMenuOpen(false)
                                                }}
                                                className="flex items-center justify-between w-full px-3 py-1.5 rounded-xl hover:bg-[#252525] text-[#CBCACA] hover:text-white transition-colors text-left text-[12px] cursor-pointer outline-none group"
                                            >
                                                <span>Created time</span>
                                                {sortBy === 'created' && (
                                                    <span className="text-white text-[14px]">
                                                        ✓
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSortBy('updated')
                                                    setIsRecentMenuOpen(false)
                                                }}
                                                className="flex items-center justify-between w-full px-3 py-1.5 rounded-xl hover:bg-[#252525] text-[#CBCACA] hover:text-white transition-colors text-left text-[12px] cursor-pointer outline-none group"
                                            >
                                                <span>Last updated</span>
                                                {sortBy === 'updated' && (
                                                    <span className="text-white text-[14px]">
                                                        ✓
                                                    </span>
                                                )}
                                            </button>
                                            <div className="h-[1px] bg-[#2B2A29] mx-1 my-1" />
                                            <button
                                                onClick={() => {
                                                    setIsRecentMenuOpen(false)
                                                    onAllProjects?.()
                                                }}
                                                className="flex items-center gap-3 w-full px-3 py-1.5 rounded-xl hover:bg-[#252525] text-[#CBCACA] hover:text-white transition-colors text-left text-[12px] cursor-pointer outline-none group"
                                            >
                                                <span>View all projects</span>
                                            </button>
                                        </div>,
                                        document.body
                                    )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-[2px] mt-1 pr-1">
                        {isAuthenticated ? (
                            isProjectsLoading ? null : recentProjects.length > 0 ? (
                                recentProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="flex items-center justify-between px-3 py-1 w-full text-left rounded-lg hover:bg-[#252525] transition-colors group cursor-pointer"
                                        onClick={() => onOpenProject?.(project.id)}
                                    >
                                        <div className="flex flex-col min-w-0 pr-2 overflow-hidden">
                                            <span className="font-normal text-[12px] transition-colors tracking-tight text-[#E8E8E8] group-hover:text-[#E8E8E8] truncate">
                                                {/* @ts-expect-error */}
                                                {project.name || project.title}
                                            </span>
                                            <span className="text-[11px] text-[#8F8E8D] tracking-tight truncate mt-[1px]">
                                                {project.updatedAt || 'just now'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="px-3 py-1.5 text-[12px] font-medium text-[#616161] tracking-tight">
                                    No recent sessions
                                </div>
                            )
                        ) : (
                            <div className="px-3 py-1.5 text-[12px] font-medium text-[#616161] tracking-tight">
                                No recent sessions
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <SidebarFooter
                isAuthenticated={isAuthenticated}
                isCollapsed={isCollapsed || false}
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

            {settingsProjectId && (
                <SettingsBigModal
                    isOpen={!!settingsProjectId}
                    onClose={() => setSettingsProjectId(null)}
                    projectId={settingsProjectId}
                />
            )}
        </div>
    )
}

export default Sidebar
