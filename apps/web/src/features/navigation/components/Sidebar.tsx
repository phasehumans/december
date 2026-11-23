import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { RecentSessions } from './RecentSessions'
import { SearchModal } from './SearchModal'
import { SidebarFooter } from './SidebarFooter'

import type { SidebarProps } from '@/features/navigation/types'

import { useAppStore } from '@/app/store'
import { getViewForPath } from '@/app/types'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import { Icons } from '@/shared/components/ui/Icons'
import { OPEN_SEARCH_EVENT } from '@/shared/lib/appEvents'
import { cn } from '@/shared/lib/utils'

export { SidebarSessionsSkeleton } from './RecentSessions'

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
    const { data: sessionsData } = useSessions()
    const sessions = React.useMemo(() => sessionsData?.sessions || [], [sessionsData?.sessions])
    const navigate = useNavigate()
    const location = useLocation()
    const path = location.pathname

    const [isSearchOpen, setIsSearchOpen] = React.useState(false)
    const [isLogoAnimating, setIsLogoAnimating] = React.useState(false)
    const isSuperCrewOpen = useAppStore((s) => s.isSuperCrewOpen)
    const setIsSuperCrewOpen = useAppStore((s) => s.setIsSuperCrewOpen)

    React.useEffect(() => {
        if (isCollapsed) {
            setIsLogoAnimating(true)
            const timer = setTimeout(() => setIsLogoAnimating(false), 1000)
            return () => clearTimeout(timer)
        }
    }, [isCollapsed])

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

    // the /resume command opens search from the prompt box
    React.useEffect(() => {
        const openSearch = () => setIsSearchOpen(true)
        window.addEventListener(OPEN_SEARCH_EVENT, openSearch)
        return () => window.removeEventListener(OPEN_SEARCH_EVENT, openSearch)
    }, [])

    const isHomeActive = path === '/'
    const isProjectsActive =
        path.startsWith('/projects') ||
        path.startsWith('/all-projects') ||
        path.startsWith('/sessions')
    const isPullRequestsActive = getViewForPath(path) === 'pullrequests'
    // connections is a page of settings, so its urls count as settings too
    const isSettingsActive = getViewForPath(path) === 'profile'

    let activeIndex = 0
    if (isSearchOpen) {
        activeIndex = 1
    } else if (isSuperCrewOpen) {
        activeIndex = 2
    } else if (!isHomeActive) {
        if (isProjectsActive) activeIndex = 3
        else if (isPullRequestsActive) activeIndex = 4
        else if (isSettingsActive) activeIndex = 5
        else activeIndex = -1
    } else {
        activeIndex = 0
    }

    const hasActiveRunningSessions = React.useMemo(() => {
        return (sessions || []).some(
            (s) => s.vmStatus === 'RUNNING' || s.vmStatus === 'PROVISIONING'
        )
    }, [sessions])

    // archiving or deleting the session on screen lands on home (M4-a)
    const goHome = () => {
        if (onNewThread) onNewThread()
        else if (onHomeClick) onHomeClick()
        else navigate('/')
    }

    const navItems = [
        {
            id: 'new',
            label: 'New',
            icon: (
                <div className="w-[19px] h-[19px] rounded-full bg-[#333333] flex items-center justify-center shrink-0">
                    <Icons.Plus className="w-2.5 h-2.5 text-[#E8E8E8]" strokeWidth={2.5} />
                </div>
            ),
            onClick: () => {
                if (onNewThread) {
                    onNewThread()
                } else if (onHomeClick) {
                    onHomeClick()
                } else {
                    navigate('/')
                }
                const el = document.getElementById('main-scroll-container')
                el?.scrollTo({ top: 0, behavior: 'smooth' })
                window.dispatchEvent(new CustomEvent('december:new-session'))
                setTimeout(() => {
                    document.getElementById('home-prompt-textarea')?.focus()
                }, 50)
            },
        },
        {
            id: 'search',
            label: 'Search',
            icon: <Icons.Search className="w-[17px] h-[17px]" />,
            onClick: () => {
                if (isAuthenticated) {
                    setIsSearchOpen(true)
                } else {
                    if (onOpenAuth) onOpenAuth()
                }
            },
        },
        {
            id: 'supercrew',
            label: 'Super Crew',
            icon: <Icons.CrewDots className="w-[17px] h-[17px]" />,
            onClick: () => setIsSuperCrewOpen(!isSuperCrewOpen),
        },
        {
            id: 'sessions',
            label: 'Sessions',
            icon: (
                <div className="relative flex items-center justify-center">
                    <Icons.Folder className="w-[17px] h-[17px]" />
                    {hasActiveRunningSessions && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse border border-[#1E1E1E]" />
                    )}
                </div>
            ),
            onClick: onSessions,
        },
        {
            id: 'pullrequests',
            label: 'Pull requests',
            icon: <Icons.GitPullRequest className="w-[17px] h-[17px]" />,
            onClick: () => {
                if (isAuthenticated) navigate('/pull-requests')
                else if (onOpenAuth) onOpenAuth()
            },
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: <Icons.Settings className="w-[17px] h-[17px]" />,
            onClick: onProfile,
        },
    ]

    return (
        <div
            className={cn(
                'hidden md:flex flex-col h-screen bg-sidebar border-r border-white/5 pt-0 pb-0 z-[60] font-sans transition-all duration-300',
                isCollapsed ? 'w-[56px] items-center' : 'w-[200px]'
            )}
        >
            {isCollapsed ? (
                <div className="px-2 mb-2 mt-0 z-30 relative">
                    <div className="flex items-center justify-center w-full h-11 mb-2 mt-0">
                        <div
                            className="flex items-center justify-center w-[32px] h-[32px] relative group cursor-pointer rounded-[10px] hover:bg-[#252525] transition-colors"
                            onClick={(e) => {
                                e.stopPropagation()
                                onExpand?.()
                            }}
                        >
                            <Icons.DecemberLogo
                                className={cn(
                                    'w-6 h-6 text-[#D6D5D4] group-hover:hidden',
                                    isLogoAnimating
                                        ? 'transition-transform duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] rotate-[360deg]'
                                        : 'rotate-0'
                                )}
                            />
                            <div className="hidden group-hover:flex items-center justify-center text-[#919191] hover:text-[#D4D4D8]">
                                <Icons.SidebarToggle className="w-4 h-4 rotate-180" />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-[2px] relative items-center">
                        {navItems.map((item, idx) => {
                            const isNew = item.id === 'new'
                            return (
                                <button
                                    key={item.id}
                                    onClick={item.onClick}
                                    className={cn(
                                        'relative flex items-center justify-center w-[32px] h-[32px] rounded-[9px] transition-all group outline-none',
                                        isNew
                                            ? ''
                                            : activeIndex === idx
                                              ? 'bg-[#1F1F1F]'
                                              : 'hover:bg-[#1C1C1C]'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'transition-colors flex items-center justify-center',
                                            isNew
                                                ? ''
                                                : activeIndex === idx
                                                  ? 'text-[#D6D5D4]'
                                                  : 'text-[#919191] group-hover:text-[#D6D5D4]'
                                        )}
                                    >
                                        {item.icon}
                                    </div>
                                    <div className="absolute top-1/2 left-[calc(100%+12px)] -translate-y-1/2 z-50 hidden group-hover:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                        <span className="text-[12px] font-medium text-[#EDEDEF]">
                                            {item.id === 'new' ? 'Create new session' : item.label}
                                        </span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="px-3 mb-2 mt-0 z-30 relative">
                    <div className="flex items-center justify-between px-2 h-11 mb-2 mt-0">
                        <Icons.DecemberLogo className="w-6 h-6 text-[#D6D5D4]" />
                        {onCollapse && (
                            <div
                                className="flex items-center justify-center text-[#919191] hover:text-[#D4D4D8] group/collapse p-1 rounded-md hover:bg-[#252525] transition-colors cursor-pointer relative"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onCollapse()
                                }}
                            >
                                <Icons.SidebarToggle className="w-4 h-4" />
                                <div className="absolute top-1/2 left-[calc(100%+12px)] -translate-y-1/2 z-50 hidden group-hover/collapse:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                    <span className="text-[12px] font-medium text-[#EDEDEF]">
                                        Close sidebar{' '}
                                        <span className="text-[#919191] ml-1 text-[10px] border border-[#333] rounded px-1 py-0.5 bg-[#252525]">
                                            Ctrl .
                                        </span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-[1px] relative">
                        {navItems.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={item.onClick}
                                className={cn(
                                    'relative flex items-center justify-between w-full px-2.5 h-[30px] rounded-[9px] transition-all group outline-none',
                                    activeIndex === idx ? 'bg-[#1F1F1F]' : 'hover:bg-[#1C1C1C]'
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
                                            'font-medium text-[13.5px] tracking-tight transition-colors truncate',
                                            activeIndex === idx
                                                ? 'text-[#D6D5D4]'
                                                : 'text-[#919191] group-hover:text-[#D6D5D4]'
                                        )}
                                    >
                                        {item.label}
                                    </span>
                                </div>
                                {item.id === 'supercrew' && (
                                    <span className="text-[10px] font-medium text-[#919191] border border-[#383735] rounded-full px-1.5 leading-4 shrink-0">
                                        Soon
                                    </span>
                                )}
                                {item.id === 'new' && (
                                    <div className="absolute top-1/2 left-[120px] -translate-y-1/2 z-50 hidden group-hover:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-md whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                        <span className="text-[12px] font-medium text-[#EDEDEF]">
                                            Create new session
                                        </span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div
                className={cn(
                    'flex-1 flex flex-col mt-0 mb-2 font-sans px-3 min-h-0',
                    isCollapsed ? 'hidden' : 'flex'
                )}
            >
                <RecentSessions
                    isAuthenticated={isAuthenticated}
                    onOpenAuth={onOpenAuth}
                    onOpenProject={onOpenProject}
                    onSessions={onSessions}
                    onLeaveCurrent={goHome}
                />
            </div>

            <SidebarFooter
                isAuthenticated={isAuthenticated}
                isCollapsed={isCollapsed || false}
                onProfile={onProfile}
                onOpenAuth={onOpenAuth}
                user={user}
                onSignOut={onSignOut}
            />

            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onNewThread={isAuthenticated ? onNewThread : onOpenAuth}
                onOpenSession={(sessionId) => onOpenProject?.(sessionId)}
                onToggleSidebar={isCollapsed ? onExpand : onCollapse}
                isAuthenticated={isAuthenticated}
                isSidebarCollapsed={isCollapsed}
            />
        </div>
    )
}

export default Sidebar
