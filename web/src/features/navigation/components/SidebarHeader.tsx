import React, { useState, useEffect } from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

export const SidebarHeader: React.FC<{ onNewThread?: () => void }> = ({ onNewThread }) => {
    const [activeTab, setActiveTab] = useState<'home' | 'canvas'>('home')

    useEffect(() => {
        const handler = (e: any) => {
            setActiveTab(e.detail ? 'canvas' : 'home')
        }
        window.addEventListener('hero-canvas-intersect', handler)
        return () => window.removeEventListener('hero-canvas-intersect', handler)
    }, [])

    return (
        <div className="px-3 mb-2 mt-0">
            <div className="bg-[#2B2A29] rounded-[14px] p-1 flex flex-col gap-0.5 -mx-1 relative">
                {/* Sliding Background */}
                <div
                    className={`absolute left-1 right-1 h-[32px] bg-[#171717] rounded-[10px] transition-transform duration-300 ease-[cubic-bezier(0.2,1,0.2,1)] ${
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
                        if (onNewThread) onNewThread()
                    }}
                    className="relative flex items-center gap-2.5 w-full px-2.5 h-[32px] rounded-[10px] transition-colors group outline-none hover:bg-white/[0.02]"
                    title="Home"
                >
                    <div
                        className={cn(
                            'transition-all flex items-center justify-center',
                            activeTab === 'home'
                                ? 'text-[#D6D5D4]'
                                : 'text-[#8F8E8D] group-hover:text-[#D6D5D4]'
                        )}
                    >
                        <Icons.DecemberLogo className="w-[18px] h-[18px]" />
                    </div>
                    <span
                        className={cn(
                            'font-medium text-[14px] tracking-wide transition-colors',
                            activeTab === 'home'
                                ? 'text-[#D6D5D4]'
                                : 'text-[#8F8E8D] group-hover:text-[#D6D5D4]'
                        )}
                    >
                        December
                    </span>
                </button>
                <button
                    onClick={() => {
                        window.dispatchEvent(
                            new CustomEvent('hero-canvas-intersect', { detail: true })
                        )
                        const el = document.getElementById('hero-canvas-container')
                        el?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="relative flex items-center gap-2.5 w-full px-2.5 h-[32px] rounded-[10px] transition-colors group outline-none hover:bg-white/[0.02]"
                    title="Canvas"
                >
                    <div
                        className={cn(
                            'transition-colors flex items-center justify-center',
                            activeTab === 'canvas'
                                ? 'text-[#D6D5D4]'
                                : 'text-[#8F8E8D] group-hover:text-[#D6D5D4]'
                        )}
                    >
                        <Icons.CanvasIcon className="w-[18px] h-[18px]" />
                    </div>
                    <span
                        className={cn(
                            'font-medium text-[14px] transition-colors',
                            activeTab === 'canvas'
                                ? 'text-[#D6D5D4]'
                                : 'text-[#8F8E8D] group-hover:text-[#D6D5D4]'
                        )}
                    >
                        Canvas
                    </span>
                </button>
            </div>
        </div>
    )
}
