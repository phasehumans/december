import React from 'react'

import type { CanvasTempItemPreviewProps } from '@/features/canvas/types'
export const CanvasTempItemPreview: React.FC<CanvasTempItemPreviewProps> = ({
    tempItem,
    buildSmoothPath,
    buildPolylinePath,
    getDraftLinePoints,
    getTempFramePath,
}) => {
    return (
        <div
            style={{
                position: 'absolute',
                left: tempItem.x,
                top: tempItem.y,
                width: Math.max(tempItem.width || 0, 2),
                height: Math.max(tempItem.height || 0, 2),
            }}
            className="pointer-events-none z-50 opacity-70"
        >
            {tempItem.type === 'frame' && (
                <svg width="100%" height="100%" className="overflow-visible">
                    <path
                        d={getTempFramePath(tempItem.width || 100, tempItem.height || 100)}
                        fill="rgba(255,255,255,0.05)"
                        stroke="#AAA"
                        strokeWidth="2"
                        strokeDasharray="8 6"
                    />
                </svg>
            )}

            {tempItem.type === 'square' && (
                <svg width="100%" height="100%" className="overflow-visible">
                    <rect
                        x="1"
                        y="1"
                        width="calc(100% - 2px)"
                        height="calc(100% - 2px)"
                        rx="10"
                        fill="rgba(255,255,255,0.05)"
                        stroke="#AAA"
                        strokeWidth="2"
                    />
                </svg>
            )}

            {tempItem.type === 'circle' && (
                <svg width="100%" height="100%" className="overflow-visible">
                    <ellipse
                        cx="50%"
                        cy="50%"
                        rx="calc(50% - 2px)"
                        ry="calc(50% - 2px)"
                        fill="rgba(255,255,255,0.05)"
                        stroke="#AAA"
                        strokeWidth="2"
                    />
                </svg>
            )}

            {(tempItem.type === 'line' || tempItem.type === 'arrow') && (
                <svg width="100%" height="100%" className="overflow-visible text-[#DDD]">
                    {tempItem.type === 'arrow' && (
                        <defs>
                            <marker
                                id="draft-arrow-head"
                                markerWidth="12"
                                markerHeight="12"
                                refX="10"
                                refY="6"
                                orient="auto"
                            >
                                <path
                                    d="M 2 2 L 10 6 L 2 10"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </marker>
                        </defs>
                    )}
                    <path
                        d={buildPolylinePath(getDraftLinePoints(tempItem))}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerEnd={tempItem.type === 'arrow' ? 'url(#draft-arrow-head)' : undefined}
                    />
                </svg>
            )}

            {tempItem.type === 'pen' && (
                <svg width="100%" height="100%" className="overflow-visible text-[#DDD]">
                    <path
                        d={buildSmoothPath(tempItem.points || [])}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </div>
    )
}
