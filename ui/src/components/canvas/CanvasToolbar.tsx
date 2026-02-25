import React, { useState } from 'react'
import {
    Image as ImageIcon,
    Globe,
    MousePointer2,
    Square,
    Type as TextIcon,
    Minus,
    Pen,
    Eraser,
    ArrowRight,
    Undo2,
    Redo2,
    Plus,
    Hand,
    Frame,
    Check,
    X,
    Circle,
    Info,
} from 'lucide-react'
import { ToolButton } from './ToolButton'
import type { CanvasItem } from '../../types'

interface CanvasToolbarProps {
    activeTool: string
    setActiveTool: (tool: string) => void
    onAddItem: (type: CanvasItem['type'], content?: string) => void
    scale: number
    setScale: (scale: number | ((prev: number) => number)) => void
    onUndo?: () => void
    onRedo?: () => void
    canUndo?: boolean
    canRedo?: boolean
    hasInteracted: boolean
    onInteract: () => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    activeTool,
    setActiveTool,
    onAddItem,
    scale,
    setScale,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    hasInteracted,
    onInteract,
    isAuthenticated,
    onOpenAuth,
}) => {
    const [isLinkInputOpen, setIsLinkInputOpen] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')

    const handleAuthCheck = (action: () => void) => {
        if (!isAuthenticated && onOpenAuth) {
            onOpenAuth()
            return
        }
        action()
    }

    const handleLinkSubmit = () => {
        handleAuthCheck(() => {
            onInteract()
            if (linkUrl) {
                onAddItem('link', linkUrl)
                setLinkUrl('')
                setIsLinkInputOpen(false)
            }
        })
    }

    const handleLinkToggle = () => {
        handleAuthCheck(() => {
            setIsLinkInputOpen(!isLinkInputOpen)
        })
    }

    return (
        <div className="absolute inset-0 z-40 pointer-events-none">
            {/* Center: Main Toolbar */}
            <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full px-4 md:px-0 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-1 p-1 bg-[#171615] border border-white/10 rounded-lg ring-1 ring-white/5 max-w-full overflow-x-auto no-scrollbar">
                    {/* Group 1: Navigation */}
                    <div className="flex items-center gap-0.5 pl-0.5">
                        <ToolButton
                            icon={MousePointer2}
                            label="Selector"
                            onClick={() => handleAuthCheck(() => setActiveTool('select'))}
                            active={activeTool === 'select'}
                        />
                        <ToolButton
                            icon={Hand}
                            label="Pan Tool"
                            onClick={() => handleAuthCheck(() => setActiveTool('hand'))}
                            active={activeTool === 'hand'}
                        />
                    </div>

                    <div className="w-px h-5 bg-white/10 mx-1" />

                    {/* Group 2: Assets */}
                    <div className="flex items-center gap-0.5">
                        <ToolButton
                            icon={ImageIcon}
                            label="Upload Image"
                            onClick={() =>
                                handleAuthCheck(() => {
                                    const input = document.createElement('input')
                                    input.type = 'file'
                                    input.accept = 'image/*'
                                    input.onchange = (e) => {
                                        onInteract() // Mark interaction on file selection
                                        const file = (e.target as HTMLInputElement).files?.[0]
                                        if (file) {
                                            const reader = new FileReader()
                                            reader.onload = (evt) => {
                                                if (evt.target?.result) {
                                                    onAddItem('image', evt.target.result as string)
                                                }
                                            }
                                            reader.readAsDataURL(file)
                                        }
                                    }
                                    input.click()
                                })
                            }
                        />
                        <ToolButton
                            icon={Globe}
                            label="Upload Website"
                            onClick={handleLinkToggle}
                            active={isLinkInputOpen}
                        />
                    </div>

                    <div className="w-px h-5 bg-white/10 mx-1" />

                    {/* Group 3: Drawing & Frames */}
                    <div className="flex items-center gap-0.5">
                        <ToolButton
                            icon={Frame}
                            label="Frame Tool"
                            onClick={() => handleAuthCheck(() => setActiveTool('frame'))}
                            active={activeTool === 'frame'}
                        />
                        {/* DISABLED */}
                        <ToolButton
                            icon={Pen}
                            label="Pen Tool (Coming Soon)"
                            onClick={() => handleAuthCheck(() => {})}
                            active={false}
                        />
                        {/* DISABLED */}
                        <ToolButton
                            icon={Eraser}
                            label="Eraser Tool (Coming Soon)"
                            onClick={() => handleAuthCheck(() => {})}
                            active={false}
                        />
                    </div>

                    <div className="w-px h-5 bg-white/10 mx-1" />

                    {/* Group 4: Shapes & Text */}
                    <div className="flex items-center gap-0.5">
                        {/* DISABLED */}
                        <ToolButton
                            icon={Square}
                            label="Rectangle (Coming Soon)"
                            onClick={() => handleAuthCheck(() => {})}
                        />
                        {/* DISABLED */}
                        <ToolButton
                            icon={Circle}
                            label="Circle (Coming Soon)"
                            onClick={() => handleAuthCheck(() => {})}
                        />
                        {/* DISABLED */}
                        <ToolButton
                            icon={Minus}
                            label="Line (Coming Soon)"
                            onClick={() => handleAuthCheck(() => {})}
                        />
                        {/* DISABLED */}
                        <ToolButton
                            icon={ArrowRight}
                            label="Arrow (Coming Soon)"
                            onClick={() => handleAuthCheck(() => {})}
                        />
                        {/* DISABLED */}
                        <ToolButton
                            icon={TextIcon}
                            label="Text (Coming Soon)"
                            onClick={() => handleAuthCheck(() => {})}
                        />
                    </div>

                    <div className="w-px h-5 bg-white/10 mx-1" />

                    {/* Group 5: Help */}
                    <div className="flex items-center gap-0.5 pr-0.5">
                        <ToolButton
                            icon={Info}
                            label="How to use"
                            onClick={() =>
                                window.open('https://www.youtube.com/@phasehumans', '_blank')
                            }
                        />
                    </div>
                </div>

                {/* Link Input Popover */}
                {isLinkInputOpen && (
                    <div className="bg-[#171615] border border-white/10 rounded-lg p-1.5 shadow-2xl flex items-center gap-2 pointer-events-auto min-w-[320px] animate-in fade-in slide-in-from-top-2 ring-1 ring-white/5">
                        <div className="pl-3 pr-2 flex items-center justify-center text-neutral-400">
                            <Globe size={14} />
                        </div>
                        <input
                            autoFocus
                            type="url"
                            placeholder="Enter website URL..."
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLinkSubmit()}
                            className="flex-1 bg-transparent border-none text-xs text-[#E8E8E6] placeholder-neutral-500 focus:outline-none focus:ring-0 h-8"
                        />
                        <button
                            onClick={handleLinkSubmit}
                            className="w-7 h-7 flex items-center justify-center bg-white text-black rounded-md hover:bg-neutral-200 transition-colors shrink-0"
                        >
                            <Check size={14} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={() => setIsLinkInputOpen(false)}
                            className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-white/10 rounded-md transition-colors shrink-0"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Left: Controls (Zoom & Undo/Redo) */}
            <div className="absolute bottom-4 left-4 pointer-events-auto flex items-center gap-2">
                {/* Zoom */}
                <div className="flex items-center p-1 bg-[#171615] border border-white/10 rounded-lg shadow-xl shadow-black/20 ring-1 ring-white/5">
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

                {/* Undo/Redo */}
                <div className="flex items-center p-1 bg-[#171615] border border-white/10 rounded-lg shadow-xl shadow-black/20 ring-1 ring-white/5">
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
        </div>
    )
}
