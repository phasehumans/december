import React from 'react'
import { motion } from 'framer-motion'
import { X, Type as TextIcon, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { CanvasItem } from '../../types'

interface CanvasItemComponentProps {
    item: CanvasItem
    isSelected: boolean
    onSelect: () => void
    onRemove: () => void
    onDragging?: (delta: { x: number; y: number }) => void
    onDragStart?: () => void
    onDragEnd?: () => void
    onConnectStart?: (itemId: string, side: 'left' | 'right', e: React.PointerEvent) => void
    onConnectEnd?: (itemId: string, side: 'left' | 'right') => void
    onUpdate?: (updates: Partial<CanvasItem>) => void
    scale: number
    activeTool?: string
}

export const CanvasItemComponent: React.FC<CanvasItemComponentProps> = ({
    item,
    isSelected,
    onSelect,
    onRemove,
    onDragging,
    onDragStart,
    onDragEnd,
    onConnectStart,
    onConnectEnd,
    onUpdate,
    scale,
    activeTool,
}) => {
    const isChild = !!item.parentId
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)

    const drawTools = new Set(['frame', 'square', 'circle', 'line', 'arrow', 'pen', 'text', 'eraser'])

    const getLineEndpoints = () => {
        if (item.points && item.points.length >= 2) {
            const first = item.points[0]!
            const last = item.points[item.points.length - 1]!
            return { x1: first.x, y1: first.y, x2: last.x, y2: last.y }
        }

        const w = Math.max(item.width || 192, 2)
        const h = Math.max(item.height || 24, 2)
        return { x1: 2, y1: h / 2, x2: w - 2, y2: h / 2 }
    }

    const getPenPath = () => {
        if (!item.points || item.points.length < 2) return ''
        return item.points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')
    }

    // Quick Delete Button Component
    const DeleteButton = () => (
        <button
            onClick={(e) => {
                e.stopPropagation()
                onRemove()
            }}
            className="absolute -top-3 -right-3 bg-black border border-white/10 text-neutral-400 hover:text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all z-50 hover:bg-neutral-800 hover:border-white/20 shadow-xl scale-75 hover:scale-100"
            title="Remove item"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <X size={12} strokeWidth={2.5} />
        </button>
    )

    const handlePointerDown = (e: React.PointerEvent) => {
        // Let the canvas own interactions while a draw tool is active.
        if (activeTool && drawTools.has(activeTool) && activeTool !== 'select') {
            return
        }

        // If it's a child item (inside a frame), we don't drag it, but we might select it
        if (isChild) {
            if (e.button === 0) {
                e.stopPropagation()
                onSelect()
            }
            return
        }

        // Only handle left click for drag
        if (e.button !== 0) return

        e.stopPropagation() // Prevent canvas panning
        e.preventDefault() // Prevent default selection/drag behaviors

        onSelect()

        if (onDragStart) onDragStart()

        const startX = e.clientX
        const startY = e.clientY
        let lastX = startX
        let lastY = startY
        let hasMoved = false

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - lastX
            const deltaY = moveEvent.clientY - lastY

            lastX = moveEvent.clientX
            lastY = moveEvent.clientY

            if (moveEvent.clientX !== startX || moveEvent.clientY !== startY) {
                hasMoved = true
            }

            if (onDragging && (deltaX !== 0 || deltaY !== 0)) {
                // Apply scale correction
                const scaleFactor = scale / 100
                onDragging({ x: deltaX / scaleFactor, y: deltaY / scaleFactor })
            }
        }

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)

            if (hasMoved && onDragEnd) {
                onDragEnd()
            }
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
    }

    // Helper for Frame Path
    const getFramePath = (w: number, h: number) => {
        const width = Math.max(w, 50)
        const height = Math.max(h, 50)
        const radius = 10
        const tabHeight = 35
        const tabWidth = 140 // Fixed tab width for consistency
        const tw = Math.min(tabWidth, width - radius) // clamp tab width

        // Folder shape path definition
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

    // Frame Types
    const FRAME_TYPES = [
        'LANDING',
        'CONTENT',
        'AUTH',
        'DASHBOARD',
        'LIST',
        'DETAIL',
        'ACCOUNT',
        'CUSTOM',
    ]

    const lineEndpoints = getLineEndpoints()
    const penPath = getPenPath()

    return (
        <motion.div
            initial={false}
            // Use duration: 0 for instant position updates during drag
            animate={{ x: item.x, y: item.y }}
            transition={{ type: 'tween', duration: 0 }}
            onPointerDown={handlePointerDown}
            style={{
                width: item.width,
                height: item.height,
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: isChild ? 20 : 10,
            }}
            className={cn(
                'group outline-none select-none',
                !isChild ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                // Default sizes if width/height not set
                item.type === 'note' && !item.width && 'w-64',
                item.type === 'text' && !item.width && 'w-56 h-12',
                item.type === 'link' && !item.width && 'w-[480px]',
                item.type === 'image' && !item.width && 'w-80 h-72',
                item.type === 'frame' && !item.width && 'w-96 h-96',
                (item.type === 'square' || item.type === 'circle') && !item.width && 'w-32 h-32',
                (item.type === 'line' || item.type === 'arrow') &&
                    !item.width &&
                    'w-48 h-12 flex items-center',
                item.type === 'pen' && !item.width && 'w-48 h-24'
            )}
        >
            {/* Selection Outline (Hidden for Frame, as frame itself is the border) */}
            {item.type !== 'frame' && (
                <div
                    className={cn(
                        'absolute -inset-[3px] rounded-2xl border transition-all duration-200 pointer-events-none z-0',
                        isSelected
                            ? 'border-neutral-400/50 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] opacity-100'
                            : 'border-transparent opacity-0 group-hover:opacity-100 group-hover:border-white/10'
                    )}
                />
            )}

            <div className="relative z-10 w-full h-full">
                {/* Note Item */}
                {item.type === 'note' && (
                    <div className="relative overflow-hidden shadow-xl bg-[#FEF9C3] text-neutral-900 rounded-xl border border-neutral-200/50">
                        <DeleteButton />
                        <div className="p-4 min-h-[160px] flex flex-col">
                            <textarea
                                placeholder="Type text..."
                                className="w-full h-full bg-transparent border-none outline-none resize-none text-sm font-medium placeholder-neutral-500/50 leading-relaxed text-neutral-900"
                                autoFocus
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                            <div className="mt-auto text-[10px] text-neutral-500 font-medium uppercase tracking-wider opacity-50 pt-2 flex items-center gap-1">
                                <TextIcon size={10} />
                                Text
                            </div>
                        </div>
                    </div>
                )}

                {/* Text Item */}
                {item.type === 'text' && (
                    <div className="w-full h-full relative">
                        <DeleteButton />
                        <textarea
                            defaultValue={item.content || ''}
                            placeholder="Text"
                            onPointerDown={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                                const nextText = e.target.value.trim()
                                if (!nextText) {
                                    onRemove()
                                    return
                                }
                                onUpdate && onUpdate({ content: e.target.value })
                            }}
                            className="w-full h-full bg-transparent resize-none text-[22px] leading-tight font-medium text-[#E8E8E6] placeholder-neutral-500/70 border-none outline-none"
                        />
                    </div>
                )}

                {/* Image Item */}
                {item.type === 'image' && (
                    <div className="bg-[#1C1C1E] rounded-xl border border-white/10 overflow-hidden shadow-xl flex flex-col h-full ring-1 ring-black/40 group-hover:border-neutral-700 transition-colors">
                        {!isChild && <DeleteButton />}
                        <div className="relative w-full h-[65%] overflow-hidden bg-[#111] border-b border-white/5 group/img">
                            <img
                                src={item.content}
                                alt=""
                                className="w-full h-full object-cover opacity-90 group-hover/img:opacity-100 transition-opacity duration-300"
                                draggable={false}
                            />
                            {isChild && <div className="absolute inset-0 bg-transparent" />}
                        </div>
                        <div className="flex-1 p-3 bg-[#222] flex flex-col">
                            <textarea
                                className="w-full h-full bg-transparent resize-none text-[13px] text-[#E8E8E6] placeholder-neutral-500/70 focus:outline-none leading-relaxed font-sans"
                                placeholder="Describe how to use this image..."
                                onKeyDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                )}

                {/* Link Item */}
                {item.type === 'link' && (
                    <div className="w-full h-full bg-[#252423] border border-white/10 rounded-xl flex items-center justify-center">
                        <DeleteButton />
                        <span className="text-neutral-500 text-xs">{item.content}</span>
                    </div>
                )}

                {/* Frame / Folder Item */}
                {item.type === 'frame' && (
                    <div className="w-full h-full relative group">
                        {/* Delete Button (visible on hover) */}
                        <div className="absolute top-1 right-2 z-50">
                            <DeleteButton />
                        </div>

                        {/* The Dashed Folder SVG */}
                        <svg
                            width="100%"
                            height="100%"
                            className="overflow-visible"
                            style={{
                                filter: isSelected
                                    ? 'drop-shadow(0 0 4px rgba(255,255,255,0.1))'
                                    : 'none',
                            }}
                        >
                            <path
                                d={getFramePath(item.width || 320, item.height || 320)}
                                fill="rgba(255,255,255,0.001)" // Almost transparent fill to capture clicks for dragging
                                stroke={isSelected ? '#E8E8E6' : '#555'}
                                strokeWidth="2"
                                strokeDasharray="8 6"
                                strokeLinejoin="round"
                                className="transition-colors duration-200"
                            />
                        </svg>

                        {/* Tab Label Area */}
                        <div className="absolute top-0 left-0 w-[140px] h-[35px] flex items-center pl-4 pr-3">
                            <div className="relative w-full group/select h-full flex items-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setIsDropdownOpen(!isDropdownOpen)
                                    }}
                                    className="w-full flex items-center justify-between bg-transparent text-[10px] uppercase font-bold tracking-widest text-neutral-500 hover:text-white transition-colors focus:outline-none"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <span>
                                        {item.content &&
                                        FRAME_TYPES.includes(item.content.toUpperCase())
                                            ? item.content.toUpperCase()
                                            : 'CUSTOM'}
                                    </span>
                                    <ChevronDown
                                        size={10}
                                        strokeWidth={2.5}
                                        className={cn(
                                            'transition-transform',
                                            isDropdownOpen ? 'rotate-180' : ''
                                        )}
                                    />
                                </button>

                                {isDropdownOpen && (
                                    <div
                                        className="absolute top-full left-0 w-[160px] bg-[#1C1C1E] border border-white/10 rounded-md shadow-2xl z-[100] overflow-hidden flex flex-col py-1 mt-1"
                                        onPointerDown={(e) => e.stopPropagation()}
                                    >
                                        {FRAME_TYPES.map((opt) => (
                                            <button
                                                key={opt}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (onUpdate) onUpdate({ content: opt })
                                                    setIsDropdownOpen(false)
                                                }}
                                                className={cn(
                                                    'text-left px-3 py-3 text-[11px] font-medium tracking-wider hover:bg-[#2A2A2C] transition-colors uppercase',
                                                    (item.content || 'CUSTOM').toUpperCase() === opt
                                                        ? 'bg-neutral-800 text-white hover:bg-neutral-700'
                                                        : 'text-neutral-400 hover:text-white'
                                                )}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Connection Nodes - Visible always on frames for better UX, or on hover */}
                        {/* Left Node */}
                        <div
                            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-neutral-600 hover:bg-[#E8E8E6] hover:scale-125 rounded-full cursor-crosshair z-50 transition-all border border-[#1e1e1e]"
                            onPointerDown={(e) => {
                                e.stopPropagation()
                                onConnectStart && onConnectStart(item.id, 'left', e)
                            }}
                            onPointerUp={(e) => {
                                e.stopPropagation()
                                onConnectEnd && onConnectEnd(item.id, 'left')
                            }}
                        />

                        {/* Right Node */}
                        <div
                            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-neutral-600 hover:bg-[#E8E8E6] hover:scale-125 rounded-full cursor-crosshair z-50 transition-all border border-[#1e1e1e]"
                            onPointerDown={(e) => {
                                e.stopPropagation()
                                onConnectStart && onConnectStart(item.id, 'right', e)
                            }}
                            onPointerUp={(e) => {
                                e.stopPropagation()
                                onConnectEnd && onConnectEnd(item.id, 'right')
                            }}
                        />
                    </div>
                )}

                {/* Square */}
                {item.type === 'square' && (
                    <div className="w-full h-full relative">
                        <DeleteButton />
                        <svg width="100%" height="100%" className="w-full h-full block">
                            <rect
                                x="2"
                                y="2"
                                width="calc(100% - 4px)"
                                height="calc(100% - 4px)"
                                rx="12"
                                fill="#252423"
                                stroke="#333"
                                strokeWidth="2"
                                className="group-hover:stroke-neutral-500 transition-colors"
                            />
                        </svg>
                    </div>
                )}

                {/* Circle */}
                {item.type === 'circle' && (
                    <div className="w-full h-full relative">
                        <DeleteButton />
                        <svg width="100%" height="100%" className="w-full h-full block">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="calc(50% - 2px)"
                                fill="#252423"
                                stroke="#333"
                                strokeWidth="2"
                                className="group-hover:stroke-neutral-500 transition-colors"
                            />
                        </svg>
                    </div>
                )}

                {/* Line */}
                {item.type === 'line' && (
                    <div className="w-full h-full flex items-center justify-center relative text-white">
                        <DeleteButton />
                        <svg width="100%" height="100%" className="overflow-visible">
                            <line
                                x1={lineEndpoints.x1}
                                y1={lineEndpoints.y1}
                                x2={lineEndpoints.x2}
                                y2={lineEndpoints.y2}
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                className="group-hover:text-neutral-300 transition-colors"
                            />
                        </svg>
                    </div>
                )}

                {/* Arrow */}
                {item.type === 'arrow' && (
                    <div className="w-full h-full flex items-center relative text-white">
                        <DeleteButton />
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
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </marker>
                            </defs>
                            <line
                                x1={lineEndpoints.x1}
                                y1={lineEndpoints.y1}
                                x2={lineEndpoints.x2}
                                y2={lineEndpoints.y2}
                                stroke="currentColor"
                                strokeWidth="1.5"
                                markerEnd={`url(#arrow-head-item-${item.id})`}
                                className="group-hover:text-neutral-300 transition-colors"
                            />
                        </svg>
                    </div>
                )}

                {/* Pen */}
                {item.type === 'pen' && (
                    <div className="w-full h-full relative text-white">
                        <DeleteButton />
                        <svg width="100%" height="100%" className="overflow-visible">
                            <path
                                d={penPath}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                )}
            </div>
        </motion.div>
    )
}



