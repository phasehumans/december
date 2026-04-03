import React from 'react'
import { Icons } from '@/shared/components/ui/Icons'

export const HomeHeader: React.FC = () => {
    return (
        <div className="absolute top-4 right-4 md:top-6 md:right-16 z-50 flex flex-col items-end gap-1">
            <div className="flex items-center gap-3">
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
                <a
                    href="https://youtube.com/@phasehumans"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1"
                >
                    <Icons.YouTube className="w-[22px] h-[22px]" />
                </a>
            </div>
            <div className="flex items-center gap-2 mr-[60px] mt-[10px] opacity-0 animate-fadeIn select-none pointer-events-none delay-700">
                <span className="font-hand text-[20px] text-neutral-400 tracking-wide mt-2">
                    @phasehumans
                </span>
                <Icons.HandDrawnArrow className="w-10 h-10 text-neutral-400 -mt-3 -rotate-[15deg]" />
            </div>
        </div>
    )
}
