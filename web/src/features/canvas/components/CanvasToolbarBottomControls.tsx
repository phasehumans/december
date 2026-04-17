import React from 'react'
import { Minus, Plus, Undo2, Redo2 } from 'lucide-react'

interface CanvasToolbarBottomControlsProps {
    scale: number
    setScale: (scale: number | ((prev: number) => number)) => void
    onUndo?: () => void
    onRedo?: () => void
    canUndo?: boolean
    canRedo?: boolean
}

export const CanvasToolbarBottomControls: React.FC<CanvasToolbarBottomControlsProps> = ({
    scale,
    setScale,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
}) => {
    return (
        <div className="absolute bottom-4 left-4 pointer-events-auto flex items-center gap-2">
            <div className="flex items-center p-1 bg-[#171615] border border-white/10 rounded-lg ring-1 ring-white/5">
                <button
                    onClick={() => setScale((s) => Math.max(50, s - 10))}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Zoom Out"
                >
                    <Minus size={14} />
                </button>
                <span className="text-[10px] font-medium text-neutral-300 w-8 text-center select-none font-mono">
                    {Math.round(scale)}%
                </span>
                <button
                    onClick={() => setScale((s) => Math.min(150, s + 10))}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Zoom In"
                >
                    <Plus size={14} />
                </button>
            </div>

            <div className="flex items-center p-1 bg-[#171615] border border-white/10 rounded-lg ring-1 ring-white/5">
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Undo"
                >
                    <Undo2 size={14} />
                </button>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Redo"
                >
                    <Redo2 size={14} />
                </button>
            </div>
        </div>
    )
}
