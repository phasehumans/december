import React from 'react'
import type { CanvasConnectionsLayerProps } from '@/features/canvas/types'
export const CanvasConnectionsLayer: React.FC<CanvasConnectionsLayerProps> = ({
    connections,
    connectionDraft,
    getAnchorPoint,
    getConnectionPath,
}) => {
    return (
        <svg className="absolute inset-0 z-0 h-full w-full overflow-visible pointer-events-none">
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#A09F9D" />
                </marker>
                <marker
                    id="circle-marker"
                    markerWidth="8"
                    markerHeight="8"
                    refX="4"
                    refY="4"
                    orient="auto"
                >
                    <circle cx="4" cy="4" r="2.5" fill="#A09F9D" />
                </marker>
            </defs>

            {connections.map((conn) => {
                const start = getAnchorPoint(conn.from, conn.fromSide)
                const end = getAnchorPoint(conn.to, conn.toSide)
                return (
                    <path
                        key={conn.id}
                        d={getConnectionPath(start.x, start.y, end.x, end.y)}
                        fill="none"
                        stroke="#A09F9D"
                        strokeWidth="2"
                        markerStart="url(#circle-marker)"
                        markerEnd="url(#arrowhead)"
                        className="opacity-80"
                    />
                )
            })}

            {connectionDraft && connectionDraft.toPoint && (
                <path
                    d={getConnectionPath(
                        getAnchorPoint(connectionDraft.fromId, connectionDraft.fromSide).x,
                        getAnchorPoint(connectionDraft.fromId, connectionDraft.fromSide).y,
                        connectionDraft.toPoint.x,
                        connectionDraft.toPoint.y
                    )}
                    fill="none"
                    stroke="#A09F9D"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    markerStart="url(#circle-marker)"
                    markerEnd="url(#arrowhead)"
                    className="opacity-60"
                />
            )}
        </svg>
    )
}
