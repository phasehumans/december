import React from 'react'
import type { CanvasResizeHandlesProps, LineHandle, ShapeHandle } from '@/features/canvas/types'

export const CanvasResizeHandles: React.FC<CanvasResizeHandlesProps> = ({
    showShapeResizeHandles,
    showLineHandles,
    lineStart,
    lineEnd,
    onShapeHandleDown,
    onLineHandleDown,
}) => {
    return (
        <>
            {showShapeResizeHandles && (
                <>
                    <div
                        className="absolute -top-1.5 -left-1.5 z-50 h-3 w-3 rounded-full border border-black/60 bg-white cursor-nwse-resize"
                        onPointerDown={(e) => onShapeHandleDown('nw', e)}
                    />
                    <div
                        className="absolute -top-1.5 left-1/2 z-50 h-3 w-3 -translate-x-1/2 rounded-full border border-black/60 bg-white cursor-ns-resize"
                        onPointerDown={(e) => onShapeHandleDown('n', e)}
                    />
                    <div
                        className="absolute -top-1.5 -right-1.5 z-50 h-3 w-3 rounded-full border border-black/60 bg-white cursor-nesw-resize"
                        onPointerDown={(e) => onShapeHandleDown('ne', e)}
                    />
                    <div
                        className="absolute top-1/2 -right-1.5 z-50 h-3 w-3 -translate-y-1/2 rounded-full border border-black/60 bg-white cursor-ew-resize"
                        onPointerDown={(e) => onShapeHandleDown('e', e)}
                    />
                    <div
                        className="absolute -bottom-1.5 -left-1.5 z-50 h-3 w-3 rounded-full border border-black/60 bg-white cursor-nesw-resize"
                        onPointerDown={(e) => onShapeHandleDown('sw', e)}
                    />
                    <div
                        className="absolute -bottom-1.5 left-1/2 z-50 h-3 w-3 -translate-x-1/2 rounded-full border border-black/60 bg-white cursor-ns-resize"
                        onPointerDown={(e) => onShapeHandleDown('s', e)}
                    />
                    <div
                        className="absolute -bottom-1.5 -right-1.5 z-50 h-3 w-3 rounded-full border border-black/60 bg-white cursor-nwse-resize"
                        onPointerDown={(e) => onShapeHandleDown('se', e)}
                    />
                    <div
                        className="absolute top-1/2 -left-1.5 z-50 h-3 w-3 -translate-y-1/2 rounded-full border border-black/60 bg-white cursor-ew-resize"
                        onPointerDown={(e) => onShapeHandleDown('w', e)}
                    />
                </>
            )}

            {showLineHandles && lineStart && lineEnd && (
                <>
                    <div
                        className="absolute z-50 h-3 w-3 cursor-pointer rounded-full border border-black/60 bg-white"
                        style={{ left: lineStart.x - 6, top: lineStart.y - 6 }}
                        onPointerDown={(e) => onLineHandleDown('start', e)}
                    />
                    <div
                        className="absolute z-50 h-3 w-3 cursor-pointer rounded-full border border-black/60 bg-white"
                        style={{ left: lineEnd.x - 6, top: lineEnd.y - 6 }}
                        onPointerDown={(e) => onLineHandleDown('end', e)}
                    />
                </>
            )}
        </>
    )
}

