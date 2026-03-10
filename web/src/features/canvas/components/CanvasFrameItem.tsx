import React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { CanvasFrameItemProps } from '@/features/canvas/types'
import { CanvasDeleteButton } from './CanvasDeleteButton'

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

const getFramePath = (widthValue: number, heightValue: number) => {
    const width = Math.max(widthValue, 50)
    const height = Math.max(heightValue, 50)
    const radius = 10
    const tabHeight = 35
    const tabWidth = 140
    const tw = Math.min(tabWidth, width - radius)

    return `
      M 0 ${radius}
      Q 0 0 ${radius} 0
      L ${tw - radius} 0
      Q ${tw} 0 ${tw} ${radius}
      L ${tw} ${tabHeight}
      L ${width - radius} ${tabHeight}
      Q ${width} ${tabHeight} ${width} ${tabHeight + radius}
      L ${width} ${height - radius}
      Q ${width} ${height} ${width - radius} ${height}
      L ${radius} ${height}
      Q 0 ${height} 0 ${height - radius}
      Z
    `
}

export const CanvasFrameItem: React.FC<CanvasFrameItemProps> = ({
    item,
    isSelected,
    isDropdownOpen,
    setIsDropdownOpen,
    onRemove,
    onUpdate,
    onUpdateEnd,
    onConnectStart,
    onConnectEnd,
}) => {
    return (
        <div className="relative h-full w-full group">
            <div className="absolute top-1 right-2 z-50">
                <CanvasDeleteButton onRemove={onRemove} />
            </div>

            <svg
                width="100%"
                height="100%"
                className="overflow-visible"
                style={{
                    filter: isSelected ? 'drop-shadow(0 0 4px rgba(255,255,255,0.1))' : 'none',
                }}
            >
                <path
                    d={getFramePath(item.width || 320, item.height || 320)}
                    fill="rgba(255,255,255,0.001)"
                    stroke={isSelected ? '#E8E8E6' : '#555'}
                    strokeWidth="2"
                    strokeDasharray="8 6"
                    strokeLinejoin="round"
                    className="transition-colors duration-200"
                />
            </svg>

            <div className="absolute top-0 left-0 h-[35px] w-[140px] flex items-center pl-4 pr-3">
                <div className="relative h-full w-full flex items-center group/select">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsDropdownOpen(!isDropdownOpen)
                        }}
                        className="w-full flex items-center justify-between bg-transparent text-[10px] uppercase font-bold tracking-widest text-neutral-500 hover:text-white transition-colors focus:outline-none"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <span>
                            {item.content && FRAME_TYPES.includes(item.content.toUpperCase())
                                ? item.content.toUpperCase()
                                : 'CUSTOM'}
                        </span>
                        <ChevronDown
                            size={10}
                            strokeWidth={2.5}
                            className={cn(
                                'transition-transform',
                                isDropdownOpen ? 'rotate-180' : ''
                            )}
                        />
                    </button>

                    {isDropdownOpen && (
                        <div
                            className="absolute top-full left-0 z-[100] mt-1 flex w-[160px] flex-col overflow-hidden rounded-md border border-white/10 bg-[#1C1C1E] py-1 shadow-2xl"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            {FRAME_TYPES.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (onUpdate)
                                            onUpdate({ content: opt }, { commitHistory: false })
                                        onUpdateEnd && onUpdateEnd()
                                        setIsDropdownOpen(false)
                                    }}
                                    className={cn(
                                        'text-left px-3 py-3 text-[11px] font-medium tracking-wider hover:bg-[#2A2A2C] transition-colors uppercase',
                                        (item.content || 'CUSTOM').toUpperCase() === opt
                                            ? 'bg-neutral-800 text-white hover:bg-neutral-700'
                                            : 'text-neutral-400 hover:text-white'
                                    )}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div
                className="absolute top-1/2 -left-1.5 z-50 h-3 w-3 -translate-y-1/2 rounded-full border border-[#1e1e1e] bg-neutral-600 transition-all cursor-crosshair hover:scale-125 hover:bg-[#E8E8E6]"
                onPointerDown={(e) => {
                    e.stopPropagation()
                    onConnectStart && onConnectStart(item.id, 'left', e)
                }}
                onPointerUp={(e) => {
                    e.stopPropagation()
                    onConnectEnd && onConnectEnd(item.id, 'left')
                }}
            />

            <div
                className="absolute top-1/2 -right-1.5 z-50 h-3 w-3 -translate-y-1/2 rounded-full border border-[#1e1e1e] bg-neutral-600 transition-all cursor-crosshair hover:scale-125 hover:bg-[#E8E8E6]"
                onPointerDown={(e) => {
                    e.stopPropagation()
                    onConnectStart && onConnectStart(item.id, 'right', e)
                }}
                onPointerUp={(e) => {
                    e.stopPropagation()
                    onConnectEnd && onConnectEnd(item.id, 'right')
                }}
            />
        </div>
    )
}



