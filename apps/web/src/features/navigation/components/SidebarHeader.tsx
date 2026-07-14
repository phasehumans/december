import { Home } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

export const SidebarHeader: React.FC<{
    onNewThread?: () => void
    onHomeClick?: () => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
    onCollapse?: () => void
    isCollapsed?: boolean
    onExpand?: () => void
}> = ({
    onNewThread,
    onHomeClick,
    isAuthenticated,
    onOpenAuth,
    onCollapse,
    isCollapsed,
    onExpand,
}) => {
    const [activeTab, setActiveTab] = useState<'home' | 'canvas'>('home')

    useEffect(() => {
        const handler = (e: any) => {
            setActiveTab(e.detail ? 'canvas' : 'home')
        }
        window.addEventListener('hero-canvas-intersect', handler)
        return () => window.removeEventListener('hero-canvas-intersect', handler)
    }, [])

    if (isCollapsed) {
        return (
            <div className="px-2 mb-2 mt-2 z-30 relative flex flex-col gap-2 items-center">
                <button
                    onClick={() => onExpand?.()}
                    className={cn(
                        'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all group outline-none',
                        activeTab === 'home'
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
                <button
                    onClick={() => {}}
                    className={cn(
                        'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all group outline-none',
                        activeTab === 'canvas'
                            ? 'bg-[#141414] border border-white/5 shadow-sm text-[#D6D5D4]'
                            : 'hover:bg-[#272727] text-[#919191] hover:text-[#D6D5D4]'
                    )}
                >
                    <Icons.Plus className="w-[18px] h-[18px]" />
                    <div className="absolute top-1/2 left-[calc(100%+12px)] -translate-y-1/2 z-50 hidden group-hover:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                        <span className="text-[12px] font-medium text-[#EDEDEF]">New Project</span>
                    </div>
                </button>
            </div>
        )
    }

    return (
        <div className="px-3 mb-2 mt-0 z-30 relative">
            <div className="bg-[#1F1F1F] rounded-[14px] p-1 flex flex-col gap-0.5 -mx-1 relative">
                {/* Sliding Background */}
                <div
                    className={`absolute left-1 right-1 h-[32px] bg-[#141414] border border-white/5 shadow-sm rounded-[10px] transition-transform duration-300 ease-[cubic-bezier(0.2,1,0.2,1)] ${
                        activeTab === 'canvas' ? 'translate-y-[34px]' : 'translate-y-0'
                    }`}
                />

                <button
                    onClick={() => {
                        window.dispatchEvent(
                            new CustomEvent('hero-canvas-intersect', { detail: false })
                        )
                        const el = document.getElementById('main-scroll-container')
                        el?.scrollTo({ top: 0, behavior: 'smooth' })
                        if (onHomeClick) onHomeClick()
                    }}
                    className={cn(
                        'relative flex items-center justify-between w-full px-2.5 h-[32px] rounded-[10px] transition-all group outline-none',
                        activeTab === 'home' ? '' : 'hover:bg-[#272727]'
                    )}
                >
                    <div className="flex items-center gap-2.5">
                        <div
                            className={cn(
                                'transition-all flex items-center justify-center',
                                activeTab === 'home'
                                    ? 'text-[#D6D5D4]'
                                    : 'text-[#919191] group-hover:text-[#D6D5D4]'
                            )}
                        >
                            <Home className="w-[18px] h-[18px]" />
                        </div>
                        <span
                            className={cn(
                                'font-medium text-[14px] tracking-wide transition-colors',
                                activeTab === 'home'
                                    ? 'text-[#D6D5D4]'
                                    : 'text-[#919191] group-hover:text-[#D6D5D4]'
                            )}
                        >
                            Home
                        </span>
                    </div>
                    {onCollapse && (
                        <div
                            className="flex md:hidden md:group-hover:flex items-center justify-center text-[#919191] hover:text-[#D4D4D8] group/collapse p-0.5 rounded-md hover:bg-[#333333] transition-colors"
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
                <button
                    onClick={() => {}}
                    className={cn(
                        'relative flex items-center gap-2.5 w-full px-2.5 h-[32px] rounded-[10px] transition-all group outline-none',
                        activeTab === 'canvas' ? '' : 'hover:bg-[#272727]'
                    )}
                >
                    <div
                        className={cn(
                            'transition-colors flex items-center justify-center',
                            activeTab === 'canvas'
                                ? 'text-[#D6D5D4]'
                                : 'text-[#919191] group-hover:text-[#D6D5D4]'
                        )}
                    >
                        <Icons.Plus className="w-[18px] h-[18px]" />
                    </div>
                    <span
                        className={cn(
                            'font-medium text-[14px] transition-colors',
                            activeTab === 'canvas'
                                ? 'text-[#D6D5D4]'
                                : 'text-[#919191] group-hover:text-[#D6D5D4]'
                        )}
                    >
                        New Project
                    </span>
                    <div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-50 hidden group-hover:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                        <span className="text-[12px] font-medium text-[#EDEDEF]">
                            Create new project
                        </span>
                    </div>
                </button>
            </div>
        </div>
    )
}
