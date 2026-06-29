import React, { useState, useEffect } from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

export const SidebarHeader: React.FC<{
    onNewThread?: () => void
    onHomeClick?: () => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}> = ({ onNewThread, onHomeClick, isAuthenticated, onOpenAuth }) => {
    const [activeTab, setActiveTab] = useState<'home' | 'canvas'>('home')

    useEffect(() => {
        const handler = (e: any) => {
            setActiveTab(e.detail ? 'canvas' : 'home')
        }
        window.addEventListener('hero-canvas-intersect', handler)
        return () => window.removeEventListener('hero-canvas-intersect', handler)
    }, [])

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
                        'relative flex items-center gap-2.5 w-full px-2.5 h-[32px] rounded-[10px] transition-all group outline-none',
                        activeTab === 'home' ? '' : 'hover:bg-[#272727]'
                    )}
                >
                    <div
                        className={cn(
                            'transition-all flex items-center justify-center',
                            activeTab === 'home'
                                ? 'text-white'
                                : 'text-white group-hover:text-white'
                        )}
                    >
                        <Icons.DecemberLogo className="w-[18px] h-[18px]" />
                    </div>
                    <span
                        className={cn(
                            'font-medium text-[14px] tracking-wide transition-colors',
                            activeTab === 'home'
                                ? 'text-white'
                                : 'text-white group-hover:text-white'
                        )}
                    >
                        December
                    </span>
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
                    <div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-50 hidden group-hover:flex items-center gap-1.5 bg-[#1C1B1A] border border-[#2A2928] px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                        <span className="text-[12px] font-medium text-[#EDEDEF]">
                            Create new project
                        </span>
                    </div>
                </button>
            </div>
        </div>
    )
}
