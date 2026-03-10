import React from 'react'
import { Icons } from '@/shared/components/ui/Icons'
import { Logo } from '@/shared/components/Logo'

interface MobileSidebarHeaderProps {
    onClose: () => void
    onNewThread: () => void
}

export const MobileSidebarHeader: React.FC<MobileSidebarHeaderProps> = ({
    onClose,
    onNewThread,
}) => {
    return (
        <div className="px-4 mb-6 flex items-center justify-between min-h-[40px]">
            <div
                className="cursor-pointer pl-2"
                onClick={() => {
                    onNewThread()
                    onClose()
                }}
            >
                <Logo />
            </div>
            <button
                onClick={onClose}
                className="text-[#91908F] hover:text-[#E8E8E6] transition-colors p-1.5 rounded-md hover:bg-surfaceHover"
            >
                <Icons.X size={20} />
            </button>
        </div>
    )
}
