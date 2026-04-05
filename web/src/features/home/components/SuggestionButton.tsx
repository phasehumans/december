import React from 'react'

import type { SuggestionButtonProps } from '@/features/home/types'

export const SuggestionButton: React.FC<SuggestionButtonProps> = ({ label, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D1C1B] border border-white/5 hover:bg-[#2C2C2E] hover:border-white/10 text-xs text-neutral-400 hover:text-neutral-200 transition-all group"
        >
            <span>{label}</span>
        </button>
    )
}
