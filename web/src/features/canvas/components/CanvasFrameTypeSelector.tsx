import React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import type { CanvasFrameItemProps } from '@/features/canvas/types'

const FRAME_TYPES = [
    'LANDING',
    'CONTENT',
    'AUTH',
    'DASHBOARD',
    'LIST',
    'DETAIL',
    'ACCOUNT',
    'CUSTOM',
]

interface CanvasFrameTypeSelectorProps {
    content?: string
    isDropdownOpen: boolean
    setIsDropdownOpen: (isOpen: boolean) => void
    onUpdate?: CanvasFrameItemProps['onUpdate']
    onUpdateEnd?: CanvasFrameItemProps['onUpdateEnd']
}

export const CanvasFrameTypeSelector: React.FC<CanvasFrameTypeSelectorProps> = ({
    content,
    isDropdownOpen,
    setIsDropdownOpen,
    onUpdate,
    onUpdateEnd,
}) => {
    const normalizedContent = (content || 'CUSTOM').toUpperCase()

    return (
        <div className="absolute top-0 left-0 h-[35px] w-[140px] flex items-center pl-4 pr-3">
            <div className="relative h-full w-full flex items-center group/select">
                <button
                    onClick={(event) => {
                        event.stopPropagation()
                        setIsDropdownOpen(!isDropdownOpen)
                    }}
                    className="w-full flex items-center justify-between bg-transparent text-[10px] uppercase font-bold tracking-widest text-neutral-500 hover:text-white transition-colors focus:outline-none"
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <span>
                        {FRAME_TYPES.includes(normalizedContent) ? normalizedContent : 'CUSTOM'}
                    </span>
                    <ChevronDown
                        size={10}
                        strokeWidth={2.5}
                        className={cn('transition-transform', isDropdownOpen ? 'rotate-180' : '')}
                    />
                </button>

                {isDropdownOpen && (
                    <div
                        className="absolute top-full left-0 z-[100] mt-1 flex w-[160px] flex-col overflow-hidden rounded-md border border-white/10 bg-[#1C1C1E] py-1 shadow-2xl"
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {FRAME_TYPES.map((option) => (
                            <button
                                key={option}
                                onClick={(event) => {
                                    event.stopPropagation()
                                    if (onUpdate)
                                        onUpdate({ content: option }, { commitHistory: false })
                                    onUpdateEnd?.()
                                    setIsDropdownOpen(false)
                                }}
                                className={cn(
                                    'text-left px-3 py-3 text-[11px] font-medium tracking-wider hover:bg-[#2A2A2C] transition-colors uppercase',
                                    normalizedContent === option
                                        ? 'bg-neutral-800 text-white hover:bg-neutral-700'
                                        : 'text-neutral-400 hover:text-white'
                                )}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
