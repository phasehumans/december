import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CanvasItem } from '@/types'
import { CanvasToolbar } from './canvas/CanvasToolbar'
import { CanvasItemComponent } from './canvas/CanvasItemComponent'

interface ContextCanvasProps {
  items: CanvasItem[]
  onAddItem: (item: CanvasItem) => void
  onRemoveItem?: (id: string) => void
}

export const ContextCanvas: React.FC<ContextCanvasProps> = ({
  items,
  onAddItem,
  onRemoveItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Canvas Transform State
  const [scale, setScale] = useState(100)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  // Frame Tool Drawing State
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null
  )
  const [drawCurrent, setDrawCurrent] = useState<{
    x: number
    y: number
  } | null>(null)

  const [activeTool, setActiveTool] = useState<string>('select')

  // Helpers
  const getCanvasPoint = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / (scale / 100)
    const y = (e.clientY - rect.top - pan.y) / (scale / 100)
    return { x, y }
  }

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'hand' || e.button === 1) {
      setIsPanning(true)
      return
    }

    if (activeTool === 'frame') {
      e.stopPropagation()
      const point = getCanvasPoint(e)
      setIsDrawing(true)
      setDrawStart(point)
      setDrawCurrent(point)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }))
    }

    if (isDrawing && drawStart) {
      const point = getCanvasPoint(e)
      setDrawCurrent(point)
    }
  }

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
    }

    if (isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x)
      const y = Math.min(drawStart.y, drawCurrent.y)
      const width = Math.abs(drawCurrent.x - drawStart.x)
      const height = Math.abs(drawCurrent.y - drawStart.y)

      // Only add if bigger than a small threshold
      if (width > 10 && height > 10) {
        const newItem: CanvasItem = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'frame',
          content: '',
          x,
          y,
          width,
          height,
          prompt: '',
        }
        onAddItem(newItem)
        // Reset to select after drawing once (optional, but standard for these tools)
        setActiveTool('select')
      }

      setIsDrawing(false)
      setDrawStart(null)
      setDrawCurrent(null)
    }
  }

  const handleAddItemWrapper = (type: CanvasItem['type'], content?: string) => {
    const id = Math.random().toString(36).substr(2, 9)
    const colors = ['#262626', '#171717', '#1F1F1F']

    // Spawn near center of view
    const spawnX = -pan.x + (containerRef.current?.clientWidth || 800) / 2 - 100
    const spawnY =
      -pan.y + (containerRef.current?.clientHeight || 600) / 2 - 100

    const newItem: CanvasItem = {
      id,
      type,
      content:
        content ||
        (type === 'image'
          ? 'https://images.unsplash.com/photo-1605379399642-870262d3d051?q=80&w=3272&auto=format&fit=crop'
          : type === 'link'
            ? 'https://example.com'
            : ''),
      x: Math.max(0, spawnX),
      y: Math.max(0, spawnY),
      prompt: '',
      color: type === 'note' ? '#FEF08A' : colors[0],
    }
    onAddItem(newItem)

    // Always switch to select tool after adding an item
    setActiveTool('select')
  }

  // Dynamic Cursor
  const getCursor = () => {
    if (activeTool === 'hand')
      return isPanning ? 'cursor-grabbing' : 'cursor-grab'
    if (activeTool === 'frame') return 'cursor-crosshair'
    return 'cursor-default'
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className={`relative w-full h-[calc(100vh-24px)] min-h-[600px] bg-[#141415] rounded-3xl border border-white/10 shadow-2xl overflow-hidden group ring-1 ring-white/5 select-none ${getCursor()}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => setSelectedId(null)}
      >
        {/* Dotted Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'radial-gradient(#888 1.5px, transparent 1.5px)',
            backgroundSize: `${24 * (scale / 100)}px ${24 * (scale / 100)}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* Toolbar */}
        <CanvasToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          onAddItem={handleAddItemWrapper}
          scale={scale}
          setScale={setScale}
          onUndo={() => {}} // Placeholder
          onRedo={() => {}} // Placeholder
          canUndo={true}
          canRedo={false}
        />

        {/* Canvas Items Layer - Scaled & Panned */}
        <div className="relative w-full h-full overflow-hidden">
          <motion.div
            className="w-full h-full absolute inset-0"
            animate={{
              scale: scale / 100,
              x: pan.x,
              y: pan.y,
            }}
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.1, // Faster response for pan
            }}
            style={{ transformOrigin: 'top left' }}
          >
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <CanvasItemComponent
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  onRemove={() => onRemoveItem?.(item.id)}
                />
              ))}
            </AnimatePresence>

            {/* Drawing Preview Overlay */}
            {isDrawing && drawStart && drawCurrent && (
              <div
                className="absolute border-2 border-dashed border-white/50 bg-white/5 z-50 pointer-events-none"
                style={{
                  left: Math.min(drawStart.x, drawCurrent.x),
                  top: Math.min(drawStart.y, drawCurrent.y),
                  width: Math.abs(drawCurrent.x - drawStart.x),
                  height: Math.abs(drawCurrent.y - drawStart.y),
                }}
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
