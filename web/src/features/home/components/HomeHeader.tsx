import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'

export const HomeHeader: React.FC = () => {
    return (
        <div className="absolute top-4 left-0 w-full px-4 md:px-6 z-50 flex justify-between items-start pointer-events-none">
            {/* Empty left spacer to truly center the middle element */}
            <div className="flex-1" />

            {/* Center Heading */}
            <div className="flex-1 flex justify-center pointer-events-auto">
                <div
                    onClick={() => {
                        window.dispatchEvent(
                            new CustomEvent('hero-canvas-intersect', { detail: true })
                        )
                        const el = document.getElementById('hero-canvas-container')
                        el?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="flex items-center gap-2.5 bg-[#201F1E] border border-white/5 rounded-full pl-1.5 pr-3 py-1 text-[13px] text-[#E8E8E6] shadow-sm transition-colors cursor-pointer hover:bg-[#2A2928] group"
                >
                    <span className="bg-[#2F2E2D] text-[#D6D5D4] rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide">
                        New
                    </span>
                    <span className="font-medium">Start building with Canvas</span>
                    <span className="text-neutral-600 font-light mx-0.5">|</span>
                    <div className="text-[#A09F9D] font-medium flex items-center gap-1 group-hover:text-white transition-colors">
                        Try Canvas <Icons.ArrowRight className="w-3 h-3" />
                    </div>
                </div>
            </div>

            {/* Right Icons */}
            <div className="flex-1 flex flex-col items-end gap-1 pointer-events-auto">
                <div className="flex items-center gap-1">
                    <a
                        href="https://x.com/phasehumans"
                        className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1"
                    >
                        <Icons.XLogo className="w-[15px] h-[15px]" />
                    </a>
                    <a
                        href="https://github.com/phasehumans/phasehumans.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1"
                    >
                        <Icons.Github className="w-5 h-5" />
                    </a>
                </div>
            </div>
        </div>
    )
}
