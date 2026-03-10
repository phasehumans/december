import React from 'react'

interface CanvasConnectionHandleProps {
    side: 'left' | 'right'
    onPointerDown: (event: React.PointerEvent) => void
    onPointerUp: (event: React.PointerEvent) => void
}

export const CanvasConnectionHandle: React.FC<CanvasConnectionHandleProps> = ({
    side,
    onPointerDown,
    onPointerUp,
}) => {
    const horizontalClass = side === 'left' ? '-left-1.5' : '-right-1.5'

    return (
        <div
            className={`absolute top-1/2 ${horizontalClass} z-50 h-3 w-3 -translate-y-1/2 rounded-full border border-[#1e1e1e] bg-neutral-600 transition-all cursor-crosshair hover:scale-125 hover:bg-[#E8E8E6]`}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
        />
    )
}
