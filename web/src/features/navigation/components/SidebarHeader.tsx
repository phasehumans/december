import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'

export const SidebarHeader: React.FC<{ onNewThread?: () => void }> = ({ onNewThread }) => {
    return (
        <div className="px-3 mb-2 mt-0">
            <div className="bg-[#2B2A29] rounded-[14px] p-1 flex flex-col gap-0.5 -mx-1">
                <button
                    onClick={onNewThread}
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 bg-[#171717] rounded-[10px] hover:bg-[#252422] transition-colors group outline-none"
                    title="Home"
                >
                    <div className="group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center">
                        <img
                            src="../../public/logo.png"
                            alt="PhaseHumans"
                            className="w-[20px] h-[20px] object-contain drop-shadow-sm"
                        />
                    </div>
                    <span className="font-medium text-[14px] text-[#D6D5D4] tracking-wide">
                        PhaseHumans
                    </span>
                </button>
                <button
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-[10px] hover:bg-[#252422] transition-colors group outline-none"
                    title="Canvas"
                >
                    <div className="text-[#D6D5D4] transition-colors flex items-center justify-center">
                        <Icons.CanvasIcon className="w-[18px] h-[18px]" />
                    </div>
                    <span className="font-medium text-[14px] text-[#D6D5D4] transition-colors">
                        Canvas
                    </span>
                </button>
            </div>
        </div>
    )
}
