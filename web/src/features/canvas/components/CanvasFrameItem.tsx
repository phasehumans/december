import React from 'react'
import type { CanvasFrameItemProps } from '@/features/canvas/types'
import { CanvasDeleteButton } from './CanvasDeleteButton'
import { CanvasFrameTypeSelector } from './CanvasFrameTypeSelector'
import { CanvasConnectionHandle } from './CanvasConnectionHandle'

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

            <CanvasFrameTypeSelector
                content={item.content}
                isDropdownOpen={isDropdownOpen}
                setIsDropdownOpen={setIsDropdownOpen}
                onUpdate={onUpdate}
                onUpdateEnd={onUpdateEnd}
            />

            <CanvasConnectionHandle
                side="left"
                onPointerDown={(event) => {
                    event.stopPropagation()
                    onConnectStart?.(item.id, 'left', event)
                }}
                onPointerUp={(event) => {
                    event.stopPropagation()
                    onConnectEnd?.(item.id, 'left')
                }}
            />

            <CanvasConnectionHandle
                side="right"
                onPointerDown={(event) => {
                    event.stopPropagation()
                    onConnectStart?.(item.id, 'right', event)
                }}
                onPointerUp={(event) => {
                    event.stopPropagation()
                    onConnectEnd?.(item.id, 'right')
                }}
            />
        </div>
    )
}
