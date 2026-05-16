import React from 'react'

import type { ToolButtonProps } from '@/features/canvas/types'

import { cn } from '@/shared/lib/utils'

export const ToolButton: React.FC<ToolButtonProps> = ({
    icon: Icon,
    label,
    onClick,
    isActive,
    disabled,
    buttonRef,
}) => (
    <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
            'group relative p-2.5 rounded-md transition-all duration-200 border border-transparent',
            isActive
                ? 'bg-[#C1C1C1] text-black'
                : 'text-neutral-400 hover:text-white hover:bg-white/10'
        )}
        title={label}
    >
        <Icon size={18} strokeWidth={2} />
    </button>
)
