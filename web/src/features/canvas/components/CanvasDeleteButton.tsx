import React from 'react'
import { X } from 'lucide-react'
import type { CanvasDeleteButtonProps } from '@/features/canvas/types'

export const CanvasDeleteButton: React.FC<CanvasDeleteButtonProps> = ({ onRemove }) => {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation()
                onRemove()
            }}
            className="absolute -top-3 -right-3 z-50 scale-75 rounded-full border border-white/10 bg-black p-1.5 text-neutral-400 opacity-0 shadow-xl transition-all hover:scale-100 hover:border-white/20 hover:bg-neutral-800 hover:text-white group-hover:opacity-100"
            title="Remove item"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <X size={12} strokeWidth={2.5} />
        </button>
    )
}
