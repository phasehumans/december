import React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/utils'
import { useNavigate, useLocation } from 'react-router-dom'

import { SearchModal } from './SearchModal'
import { SidebarFooter } from './SidebarFooter'
import { SidebarNavItem } from './SidebarNavItem'
import { Home, BookOpen } from 'lucide-react'

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
    const isProjectsActive = path.startsWith('/projects') || path.startsWith('/all-projects')
    const isSessionsActive = path.startsWith('/sessions')
    const isReviewActive = path.startsWith('/review')
    const isTemplatesActive = path.startsWith('/templates')
    const isDocsActive = path.startsWith('/docs')
    const isSettingsActive = path.startsWith('/settings') || path.startsWith('/profile')

    let activeIndex = 0
    if (isSearchOpen) {
        activeIndex = 1
    } else if (!isHomeActive) {
        if (isSessionsActive) activeIndex = 2
        else if (isReviewActive) activeIndex = 3
        else if (isProjectsActive) activeIndex = 4
        else if (isTemplatesActive) activeIndex = 5
        else if (isSettingsActive) activeIndex = 6
    } else {
        activeIndex = 0
    }

    const navItems = [
        {
            id: 'home',
            label: 'Home',
            icon: <Home className="w-[18px] h-[18px]" />,
            onClick: () => {
                const el = document.getElementById('main-scroll-container')
                el?.scrollTo({ top: 0, behavior: 'smooth' })
                if (onHomeClick) onHomeClick()
            },
        },
        {
            id: 'search',
            label: 'Search',
            icon: <Icons.Search className="w-[18px] h-[18px]" />,
            onClick: () => {
                if (isAuthenticated) {
                    setIsSearchOpen(true)
                } else {
                    if (onOpenAuth) onOpenAuth()
                }
            },
        },
        {
            id: 'sessions',
            label: 'Sessions',
            icon: <Icons.SessionsIcon className="w-[18px] h-[18px]" />,
            onClick: onSessions,
        },
        {
            id: 'review',
            label: 'Review',
            icon: <Icons.GitPullRequest className="w-[18px] h-[18px]" />,
            onClick: onReview,
        },
        {
            id: 'projects',
            label: 'Projects',
            icon: <Icons.Folder className="w-[18px] h-[18px]" />,
            onClick: onAllProjects,
        },
        {
            id: 'templates',
            label: 'Templates',
            icon: <Icons.Bookmark className="w-[18px] h-[18px]" />,
            onClick: onTemplates,
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: <Icons.Settings className="w-[18px] h-[18px]" />,
            onClick: onProfile,
        },
    ]

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
            {isCollapsed ? (
                <div className="px-2 mb-2 mt-2 z-30 relative flex flex-col gap-2 items-center">
                    <button
                        onClick={() => onExpand?.()}
                        className={cn(
                            'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all group outline-none',
                            activeIndex === 0
                                ? 'bg-[#141414] border border-white/5 shadow-sm text-[#D6D5D4]'
                                : 'hover:bg-[#272727] text-[#919191] hover:text-[#D6D5D4]'
                        )}
                    >
                        <Home className="w-[18px] h-[18px] group-hover:hidden" />
                        <Icons.SidebarToggle className="w-5 h-5 hidden group-hover:block" />
                        <div className="absolute top-1/2 left-[calc(100%+12px)] -translate-y-1/2 z-50 hidden group-hover:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                            <span className="text-[12px] font-medium text-[#EDEDEF]">
                                Open sidebar{' '}
                                <span className="text-[#919191] ml-1 text-[10px] border border-[#333] rounded px-1 py-0.5 bg-[#252525]">
                                    Ctrl .
                                </span>
                            </span>
                        </div>
                    </button>
                    <div className="w-6 h-[1px] bg-white/10 my-1" />
                    {navItems.slice(1).map((item, idx) => {
                        const actualIdx = idx + 1
                        return (
                            <button
                                key={item.id}
                                onClick={item.onClick}
                                className={cn(
                                    'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all group outline-none',
                                    activeIndex === actualIdx
                                        ? 'bg-[#141414] border border-white/5 shadow-sm text-[#D6D5D4]'
                                        : 'hover:bg-[#272727] text-[#919191] hover:text-[#D6D5D4]'
                                )}
                            >
                                {item.icon}
                                <div className="absolute top-1/2 left-[calc(100%+12px)] -translate-y-1/2 z-50 hidden group-hover:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                    <span className="text-[12px] font-medium text-[#EDEDEF]">
                                        {item.label}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            ) : (
                <div className="px-3 mb-2 mt-0 z-30 relative">
                    <div className="bg-[#1F1F1F] rounded-[14px] p-1 pb-1.5 flex flex-col gap-[2px] -mx-1 relative">
                        {/* Sliding Background */}
                        <div
                            className="absolute left-1 right-1 h-[32px] bg-[#141414] border border-white/5 shadow-sm rounded-[10px] transition-transform duration-300 ease-[cubic-bezier(0.34,1.2,0.64,1)]"
                            style={{ transform: `translateY(${activeIndex * 34}px)` }}
                        />

                        {navItems.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={item.onClick}
                                className={cn(
                                    'relative flex items-center justify-between w-full px-2.5 h-[32px] rounded-[10px] transition-all group outline-none',
                                    activeIndex === idx ? '' : 'hover:bg-[#1A1A1A]'
                                )}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className={cn(
                                            'transition-colors flex items-center justify-center shrink-0',
                                            activeIndex === idx
                                                ? 'text-[#D6D5D4]'
                                                : 'text-[#919191] group-hover:text-[#D6D5D4]'
                                        )}
                                    >
                                        {item.icon}
                                    </div>
                                    <span
                                        className={cn(
                                            'font-medium text-[14px] tracking-wide transition-colors truncate',
                                            activeIndex === idx
                                                ? 'text-[#D6D5D4]'
                                                : 'text-[#919191] group-hover:text-[#D6D5D4]'
                                        )}
                                    >
                                        {item.label}
                                    </span>
                                </div>
                                {idx === 0 && onCollapse && (
                                    <div
                                        className="flex md:hidden md:group-hover:flex items-center justify-center text-[#919191] hover:text-[#D4D4D8] group/collapse p-0.5 rounded-md hover:bg-[#333333] transition-colors shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onCollapse()
                                        }}
                                    >
                                        <Icons.SidebarToggle className="w-4 h-4" />
                                        <div className="absolute top-[calc(100%+4px)] right-0 z-50 hidden md:group-hover/collapse:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                            <span className="text-[12px] font-medium text-[#EDEDEF]">
                                                Close sidebar{' '}
                                                <span className="text-[#919191] ml-1 text-[10px] border border-[#333] rounded px-1 py-0.5 bg-[#252525]">
                                                    Ctrl .
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div
                className={cn(
                    'flex-1 flex flex-col mt-2 mb-2 overflow-y-auto no-scrollbar font-sans',
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
