import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'

export const HomeHeader: React.FC = () => {
    return (
        <div className="absolute top-4 left-0 w-full px-4 md:px-6 z-50 flex justify-between items-start pointer-events-none">
            {/* Empty left spacer to truly center the middle element */}
            <div className="flex-1" />

            {/* Center Heading */}
            <div className="flex-initial flex justify-center pointer-events-auto"></div>

            {/* Right Icons */}
            <div className="flex-1 flex flex-col items-end gap-1 pointer-events-auto">
                <div className="flex items-center gap-1">
                    <a
                        href="https://x.com/phasehumans"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1"
                    >
                        <Icons.XLogo className="w-[15px] h-[15px]" />
                    </a>
                    <a
                        href="https://github.com/phasehumans/december"
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
