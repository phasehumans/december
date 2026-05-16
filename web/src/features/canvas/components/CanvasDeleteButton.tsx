import { X } from 'lucide-react'
import React from 'react'

import type { CanvasDeleteButtonProps } from '@/features/canvas/types'

export const CanvasDeleteButton: React.FC<CanvasDeleteButtonProps> = ({ onRemove }) => {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation()
                onRemove()
            }}
            className="absolute -top-2.5 -right-2.5 z-50 flex items-center justify-center w-[22px] h-[22px] rounded-full border border-[#2E2D2C] bg-[#141312] text-[#656565] opacity-0 transition-all duration-200 hover:bg-[#242322] hover:text-[#D6D5D4] hover:border-[#454443] group-hover:opacity-100"
            title="Remove item"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <X size={12} strokeWidth={2.5} />
        </button>
    )
}
