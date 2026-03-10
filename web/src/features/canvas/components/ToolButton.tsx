import React from 'react'
import { cn } from '@/shared/lib/utils'
import type { ToolButtonProps } from '@/features/canvas/types'

export const ToolButton: React.FC<ToolButtonProps> = ({ icon: Icon, label, onClick, active }) => (
    <button
        onClick={onClick}
        className={cn(
            'group relative p-2.5 rounded-md transition-all duration-200 border border-transparent',
            active
                ? 'bg-[#C1C1C1] text-black'
                : 'text-neutral-400 hover:text-white hover:bg-white/10'
        )}
        title={label}
    >
        <Icon size={18} strokeWidth={2} />
    </button>
)
