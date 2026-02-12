import React, { useState } from 'react'
import {
  Image as ImageIcon,
  Link as LinkIcon,
  MousePointer2,
  Square,
  Circle,
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
} from 'lucide-react'
import { ToolButton } from './ToolButton'
import { CanvasItem } from '@/types'

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
}) => {
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const handleLinkSubmit = () => {
    if (linkUrl) {
      onAddItem('link', linkUrl)
      setLinkUrl('')
      setIsLinkInputOpen(false)
    }
  }

  return (
    <div className="absolute top-6 left-6 right-6 flex items-start justify-between z-40 pointer-events-none">
      {/* Left: Project Info */}
      <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-lg hover:border-white/20 transition-colors">
        <span className="text-xs text-white font-medium opacity-90 tracking-wide">
          Context Canvas
        </span>
      </div>

      {/* Center: Toolbar */}
      <div className="relative">
        <div className="pointer-events-auto flex items-center gap-1 p-1.5 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/5 hover:bg-[#0A0A0A] transition-colors">
          {/* Selector / Hand */}
          <ToolButton
            icon={MousePointer2}
            label="Selector"
            onClick={() => setActiveTool('select')}
            active={activeTool === 'select'}
          />
          <ToolButton
            icon={Hand}
            label="Pan Tool"
            onClick={() => setActiveTool('hand')}
            active={activeTool === 'hand'}
          />

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Uploads */}
          <ToolButton
            icon={ImageIcon}
            label="Upload Image"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.onchange = (e) => {
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
            }}
          />
          <ToolButton
            icon={LinkIcon}
            label="Upload Website"
            onClick={() => setIsLinkInputOpen(!isLinkInputOpen)}
            active={isLinkInputOpen}
          />

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Draw Tools */}
          <ToolButton
            icon={Frame}
            label="Frame Tool"
            onClick={() => setActiveTool('frame')}
            active={activeTool === 'frame'}
          />
          <ToolButton
            icon={Pen}
            label="Pen Tool"
            onClick={() => setActiveTool('pen')}
            active={activeTool === 'pen'}
          />
          <ToolButton
            icon={Eraser}
            label="Eraser Tool"
            onClick={() => setActiveTool('eraser')}
            active={activeTool === 'eraser'}
          />

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Shapes */}
          <ToolButton
            icon={Square}
            label="Square"
            onClick={() => onAddItem('square')}
          />
          <ToolButton
            icon={Circle}
            label="Circle"
            onClick={() => onAddItem('circle')}
          />
          <ToolButton
            icon={ArrowRight}
            label="Arrow"
            onClick={() => onAddItem('arrow')}
          />
          <ToolButton
            icon={Minus}
            label="Line"
            onClick={() => onAddItem('line')}
          />

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Text */}
          <ToolButton
            icon={TextIcon}
            label="Text"
            onClick={() => onAddItem('note')}
          />
        </div>

        {/* Link Input Popover */}
        {isLinkInputOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0A0A0A] border border-white/10 rounded-xl p-2 shadow-2xl flex items-center gap-2 pointer-events-auto min-w-[300px] z-50 animate-in fade-in slide-in-from-top-2">
            <input
              autoFocus
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLinkSubmit()}
              className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/20"
            />
            <button
              onClick={handleLinkSubmit}
              className="p-1.5 bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => setIsLinkInputOpen(false)}
              className="p-1.5 text-neutral-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Right: Controls (Undo/Redo & Zoom) */}
      <div className="pointer-events-auto flex items-center gap-3">
        {/* Undo/Redo */}
        <div className="flex items-center p-1 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 size={16} />
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center p-1 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg gap-1">
          <button
            onClick={() => setScale((s) => Math.max(20, s - 10))}
            className="p-2.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <Minus size={16} />
          </button>
          <span className="text-xs font-mono text-neutral-300 w-10 text-center select-none">
            {Math.round(scale)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(200, s + 10))}
            className="p-2.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
