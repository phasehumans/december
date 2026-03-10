import React from 'react'
import type { CanvasVectorItemProps } from '@/features/canvas/types'

const getStroke = (isSelected: boolean, inactiveColor: string) =>
    isSelected ? '#E8E8E6' : inactiveColor

export const CanvasVectorItem: React.FC<CanvasVectorItemProps> = ({
    item,
    isSelected,
    linePath,
    penPath,
}) => {
    const selectedStroke = getStroke(isSelected, '#9A9A9A')
    const lineStroke = getStroke(isSelected, '#C9C9C7')

    switch (item.type) {
        case 'square':
            return (
                <div className="relative h-full w-full">
                    <svg width="100%" height="100%" className="block h-full w-full">
                        <rect
                            x="2"
                            y="2"
                            width="calc(100% - 4px)"
                            height="calc(100% - 4px)"
                            rx="12"
                            fill="transparent"
                            stroke={selectedStroke}
                            strokeWidth="2"
                            className="transition-colors group-hover:stroke-neutral-200"
                        />
                    </svg>
                </div>
            )
        case 'circle':
            return (
                <div className="relative h-full w-full">
                    <svg width="100%" height="100%" className="block h-full w-full">
                        <circle
                            cx="50%"
                            cy="50%"
                            r="calc(50% - 2px)"
                            fill="transparent"
                            stroke={selectedStroke}
                            strokeWidth="2"
                            className="transition-colors group-hover:stroke-neutral-200"
                        />
                    </svg>
                </div>
            )
        case 'line':
            return (
                <div className="relative flex h-full w-full items-center justify-center text-white">
                    <svg width="100%" height="100%" className="overflow-visible">
                        <path
                            d={linePath}
                            fill="none"
                            stroke={lineStroke}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="transition-colors group-hover:text-neutral-300"
                        />
                    </svg>
                </div>
            )
        case 'arrow':
            return (
                <div className="relative flex h-full w-full items-center text-white">
                    <svg width="100%" height="100%" className="overflow-visible">
                        <defs>
                            <marker
                                id={`arrow-head-item-${item.id}`}
                                markerWidth="12"
                                markerHeight="12"
                                refX="10"
                                refY="6"
                                orient="auto"
                            >
                                <path
                                    d="M 2 2 L 10 6 L 2 10"
                                    fill="none"
                                    stroke={lineStroke}
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </marker>
                        </defs>
                        <path
                            d={linePath}
                            fill="none"
                            stroke={lineStroke}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            markerEnd={`url(#arrow-head-item-${item.id})`}
                            className="transition-colors group-hover:text-neutral-300"
                        />
                    </svg>
                </div>
            )
        case 'pen':
            return (
                <div className="relative h-full w-full text-white">
                    <svg width="100%" height="100%" className="overflow-visible">
                        <path
                            d={penPath}
                            fill="none"
                            stroke={lineStroke}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            )
        default:
            return null
    }
}
