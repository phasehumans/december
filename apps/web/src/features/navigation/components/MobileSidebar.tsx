import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { SidebarHeader } from './SidebarHeader'
import { SidebarNavItem } from './SidebarNavItem'
import { SidebarFooter } from './SidebarFooter'
import { SearchModal } from './SearchModal'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'
import { useProjects } from '@/features/projects/hooks/useProjects'
import type { MobileSidebarProps } from '@/features/navigation/types'

export const MobileSidebar: React.FC<
    MobileSidebarProps & { onSignOut?: () => void; onHomeClick?: () => void; user?: any }
> = ({
    isOpen,
    onClose,
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
    onSignOut,
    onHomeClick,
    user,
}) => {
    const { data: projects = [], isLoading: isProjectsLoading } = useProjects()
    const location = useLocation()
    const path = location.pathname

    const isHomeActive = path === '/'
    const isProjectsActive = path.startsWith('/projects')
    const isSessionsActive = path.startsWith('/sessions')
    const isReviewActive = path.startsWith('/review')
    const isTemplatesActive = path.startsWith('/templates')
    const isDocsActive = path.startsWith('/docs')
    const isSettingsActive = path.startsWith('/settings')
    const [isSearchOpen, setIsSearchOpen] = React.useState(false)
    const [isRecentMenuOpen, setIsRecentMenuOpen] = React.useState(false)
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
                    'fixed inset-y-0 left-0 w-[240px] bg-sidebar border-r border-white/5 z-[60] md:hidden flex flex-col pt-2 pb-0 transition-[transform,opacity] duration-300 ease-out will-change-transform',
                    isOpen
                        ? 'translate-x-0 opacity-100 pointer-events-auto'
                        : '-translate-x-full opacity-0 pointer-events-none'
                )}
            >
                {/* Header */}
                <div className="flex items-start justify-between pr-2">
                    <div className="flex-1">
                        <SidebarHeader
                            onNewThread={() => {
                                isAuthenticated ? onNewThread() : onOpenAuth?.()
                                onClose()
                            }}
                            onHomeClick={() => {
                                isAuthenticated ? onHomeClick?.() : onOpenAuth?.()
                                onClose()
                            }}
                            isAuthenticated={isAuthenticated}
                            onOpenAuth={onOpenAuth}
                            onCollapse={onClose}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-[1px] pl-[10px] pr-3 mt-2">
                    <SidebarNavItem
                        icon={<Icons.SessionsIcon className="w-[18px] h-[18px]" />}
                        label="Sessions"
                        active={isSessionsActive}
                        onClick={() => {
                            onSessions?.()
                            onClose()
                        }}
                        collapsed={false}
                    />
                    <SidebarNavItem
                        icon={<Icons.GitPullRequest className="w-[18px] h-[18px]" />}
                        label="Review"
                        active={isReviewActive}
                        onClick={() => {
                            onReview?.()
                            onClose()
                        }}
                        collapsed={false}
                    />
                    <SidebarNavItem
                        icon={<Icons.Folder />}
                        label="Projects"
                        active={isProjectsActive}
                        onClick={() => {
                            onAllProjects()
                            onClose()
                        }}
                        collapsed={false}
                    />
                    <SidebarNavItem
                        icon={<Icons.Bookmark />}
                        label="Templates"
                        active={isTemplatesActive}
                        onClick={() => {
                            onTemplates()
                            onClose()
                        }}
                        collapsed={false}
                    />
                    <SidebarNavItem
                        icon={<Icons.Settings className="w-[18px] h-[18px]" />}
                        label="Settings"
                        active={isSettingsActive}
                        onClick={() => {
                            onProfile()
                            onClose()
                        }}
                        collapsed={false}
                    />
                </div>

                <div className="flex-1 flex flex-col mt-4 mb-2 overflow-y-auto no-scrollbar font-sans pl-[10px] pr-3">
                    <div className="flex flex-col mb-2">
                        <div className="flex items-center justify-between px-3 py-1.5 w-full text-left">
                            <span className="font-normal text-[13px] whitespace-nowrap transition-colors tracking-tight text-[#919191]">
                                Recent
                            </span>
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={() =>
                                        isAuthenticated ? onNewThread() : onOpenAuth?.()
                                    }
                                    className="relative flex items-center justify-center p-1 rounded-md text-[#919191] hover:text-[#E8E8E8] hover:bg-[#252525] transition-all outline-none group/btn"
                                >
                                    <Icons.Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() =>
                                        isAuthenticated ? setIsSearchOpen(true) : onOpenAuth?.()
                                    }
                                    className="relative flex items-center justify-center p-1 rounded-md text-[#919191] hover:text-[#E8E8E8] hover:bg-[#252525] transition-all outline-none group/btn"
                                >
                                    <Icons.Search className="w-3.5 h-3.5" />
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
                                                    const rect =
                                                        e.currentTarget.getBoundingClientRect()
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
                                                        onClose()
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
                                            className="flex items-center justify-between px-3 py-1 w-full text-left rounded-lg hover:bg-[#252525] transition-colors cursor-pointer"
                                            onClick={() => {
                                                onOpenProject(project.id)
                                                onClose()
                                            }}
                                        >
                                            <div className="flex flex-col min-w-0 pr-2 overflow-hidden">
                                                <span className="font-normal text-[12px] transition-colors tracking-tight text-[#E8E8E8] truncate">
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
                    isCollapsed={false}
                    onProfile={() => {
                        onProfile()
                        onClose()
                    }}
                    onDocs={() => {
                        onDocs()
                        onClose()
                    }}
                    onOpenAuth={() => {
                        onOpenAuth()
                        onClose()
                    }}
                    user={user}
                    onSignOut={() => {
                        onSignOut?.()
                        onClose()
                    }}
                />

                <SearchModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    onNewThread={isAuthenticated ? onNewThread : onOpenAuth}
                    isAuthenticated={isAuthenticated}
                />
            </div>
        </>
    )
}
