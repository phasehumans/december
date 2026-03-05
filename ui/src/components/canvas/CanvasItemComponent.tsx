import React from 'react'
import { motion } from 'framer-motion'
import { X, Type as TextIcon, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { CanvasItem } from '../../types'

interface UpdateOptions {
    commitHistory?: boolean
}

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
    onUpdate?: (updates: Partial<CanvasItem>, options?: UpdateOptions) => void
    onUpdateEnd?: () => void
    scale: number
    activeTool?: string
}

const getDefaultSizeByType = (type: CanvasItem['type']) => {
    if (type === 'square' || type === 'circle') return { width: 128, height: 128 }
    if (type === 'line' || type === 'arrow') return { width: 192, height: 48 }
    if (type === 'pen') return { width: 192, height: 96 }
    if (type === 'text') return { width: 224, height: 48 }
    if (type === 'frame') return { width: 384, height: 384 }
    if (type === 'image') return { width: 320, height: 288 }
    return { width: 120, height: 80 }
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
    onUpdateEnd,
    scale,
    activeTool,
}) => {
    const isChild = !!item.parentId
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
    const isSelectMode = !activeTool || activeTool === 'select'
    const canTransform = isSelectMode && isSelected && !isChild

    const getLinePoints = React.useCallback(() => {
        if (item.points && item.points.length >= 2) {
            return item.points
        }

        const defaults = getDefaultSizeByType(item.type)
        const w = Math.max(item.width || defaults.width, 2)
        const h = Math.max(item.height || defaults.height, 2)
        return [
            { x: 2, y: h / 2 },
            { x: w - 2, y: h / 2 },
        ]
    }, [item.height, item.points, item.type, item.width])

    const buildPolylinePath = (points: { x: number; y: number }[]) => {
        if (points.length < 2) return ''
        return points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')
    }

    const buildSmoothPath = (points: { x: number; y: number }[]) => {
        if (points.length === 0) return ''
        if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`
        if (points.length === 2) {
            return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`
        }

        let d = `M ${points[0]!.x} ${points[0]!.y}`
        for (let i = 1; i < points.length - 1; i += 1) {
            const current = points[i]!
            const next = points[i + 1]!
            const midX = (current.x + next.x) / 2
            const midY = (current.y + next.y) / 2
            d += ` Q ${current.x} ${current.y} ${midX} ${midY}`
        }

        const last = points[points.length - 1]!
        d += ` L ${last.x} ${last.y}`
        return d
    }

    const normalizeLinePoints = (absolutePoints: { x: number; y: number }[]) => {
        const xs = absolutePoints.map((p) => p.x)
        const ys = absolutePoints.map((p) => p.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)

        return {
            x: minX,
            y: minY,
            width: Math.max(maxX - minX, 2),
            height: Math.max(maxY - minY, 2),
            points: absolutePoints.map((p) => ({ x: p.x - minX, y: p.y - minY })),
        }
    }

    const startShapeResize = (
        corner: 'nw' | 'ne' | 'sw' | 'se',
        e: React.PointerEvent<HTMLDivElement>
    ) => {
        if (!onUpdate) return

        e.stopPropagation()
        e.preventDefault()

        const scaleFactor = scale / 100
        const defaults = getDefaultSizeByType(item.type)

        let x = item.x
        let y = item.y
        let width = item.width || defaults.width
        let height = item.height || defaults.height
        let lastX = e.clientX
        let lastY = e.clientY

        const MIN_SIZE = 16

        const handleMove = (moveEvent: PointerEvent) => {
            const dx = (moveEvent.clientX - lastX) / scaleFactor
            const dy = (moveEvent.clientY - lastY) / scaleFactor
            lastX = moveEvent.clientX
            lastY = moveEvent.clientY

            if (corner.includes('e')) {
                width += dx
            }
            if (corner.includes('s')) {
                height += dy
            }
            if (corner.includes('w')) {
                x += dx
                width -= dx
            }
            if (corner.includes('n')) {
                y += dy
                height -= dy
            }

            if (width < MIN_SIZE) {
                if (corner.includes('w')) x -= MIN_SIZE - width
                width = MIN_SIZE
            }
            if (height < MIN_SIZE) {
                if (corner.includes('n')) y -= MIN_SIZE - height
                height = MIN_SIZE
            }

            onUpdate(
                {
                    x,
                    y,
                    width,
                    height,
                },
                { commitHistory: false }
            )
        }

        const handleUp = () => {
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleUp)
            onUpdateEnd && onUpdateEnd()
        }

        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
    }

    const startLineHandleDrag = (
        handle: 'start' | 'middle' | 'end',
        e: React.PointerEvent<HTMLDivElement>
    ) => {
        if (!onUpdate) return

        e.stopPropagation()
        e.preventDefault()

        const scaleFactor = scale / 100
        let pointsAbs = getLinePoints().map((p) => ({ x: item.x + p.x, y: item.y + p.y }))

        if (handle === 'middle' && pointsAbs.length === 2) {
            const [start, end] = pointsAbs
            pointsAbs = [
                start!,
                {
                    x: (start!.x + end!.x) / 2,
                    y: (start!.y + end!.y) / 2,
                },
                end!,
            ]
        }

        const index = handle === 'start' ? 0 : handle === 'end' ? pointsAbs.length - 1 : 1
        let lastX = e.clientX
        let lastY = e.clientY

        const handleMove = (moveEvent: PointerEvent) => {
            const dx = (moveEvent.clientX - lastX) / scaleFactor
            const dy = (moveEvent.clientY - lastY) / scaleFactor
            lastX = moveEvent.clientX
            lastY = moveEvent.clientY

            const target = pointsAbs[index]!
            pointsAbs[index] = {
                x: target.x + dx,
                y: target.y + dy,
            }

            onUpdate(normalizeLinePoints(pointsAbs), { commitHistory: false })
        }

        const handleUp = () => {
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleUp)
            onUpdateEnd && onUpdateEnd()
        }

        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
    }

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
        if (!isSelectMode) {
            return
        }

        if (isChild) {
            if (e.button === 0) {
                e.stopPropagation()
                onSelect()
            }
            return
        }

        if (e.button !== 0) return

        e.stopPropagation()
        e.preventDefault()
        onSelect()
        onDragStart && onDragStart()

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

    const getFramePath = (w: number, h: number) => {
        const width = Math.max(w, 50)
        const height = Math.max(h, 50)
        const radius = 10
        const tabHeight = 35
        const tabWidth = 140
        const tw = Math.min(tabWidth, width - radius)

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

    const linePoints = getLinePoints()
    const linePath = buildPolylinePath(linePoints)
    const lineStart = linePoints[0]
    const lineEnd = linePoints[linePoints.length - 1]
    const lineMiddle =
        linePoints.length >= 3
            ? linePoints[1]
            : {
                  x: ((lineStart?.x || 0) + (lineEnd?.x || 0)) / 2,
                  y: ((lineStart?.y || 0) + (lineEnd?.y || 0)) / 2,
              }
    const penPath = buildSmoothPath(item.points || [])

    const showShapeResizeHandles = canTransform && (item.type === 'square' || item.type === 'circle')
    const showLineHandles = canTransform && (item.type === 'line' || item.type === 'arrow')

    return (
        <motion.div
            initial={false}
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
                !isChild && isSelectMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                item.type === 'note' && !item.width && 'w-64',
                item.type === 'text' && !item.width && 'w-56 h-12',
                item.type === 'link' && !item.width && 'w-[480px]',
                item.type === 'image' && !item.width && 'w-80 h-72',
                item.type === 'frame' && !item.width && 'w-96 h-96',
                (item.type === 'square' || item.type === 'circle') && !item.width && 'w-32 h-32',
                (item.type === 'line' || item.type === 'arrow') && !item.width && 'w-48 h-12 flex items-center',
                item.type === 'pen' && !item.width && 'w-48 h-24'
            )}
        >
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

                {item.type === 'link' && (
                    <div className="w-full h-full bg-[#252423] border border-white/10 rounded-xl flex items-center justify-center">
                        <DeleteButton />
                        <span className="text-neutral-500 text-xs">{item.content}</span>
                    </div>
                )}

                {item.type === 'frame' && (
                    <div className="w-full h-full relative group">
                        <div className="absolute top-1 right-2 z-50">
                            <DeleteButton />
                        </div>

                        <svg
                            width="100%"
                            height="100%"
                            className="overflow-visible"
                            style={{
                                filter: isSelected ? 'drop-shadow(0 0 4px rgba(255,255,255,0.1))' : 'none',
                            }}
                        >
                            <path
                                d={getFramePath(item.width || 320, item.height || 320)}
                                fill="rgba(255,255,255,0.001)"
                                stroke={isSelected ? '#E8E8E6' : '#555'}
                                strokeWidth="2"
                                strokeDasharray="8 6"
                                strokeLinejoin="round"
                                className="transition-colors duration-200"
                            />
                        </svg>

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
                                        {item.content && FRAME_TYPES.includes(item.content.toUpperCase())
                                            ? item.content.toUpperCase()
                                            : 'CUSTOM'}
                                    </span>
                                    <ChevronDown
                                        size={10}
                                        strokeWidth={2.5}
                                        className={cn('transition-transform', isDropdownOpen ? 'rotate-180' : '')}
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
                                                    if (onUpdate) onUpdate({ content: opt }, { commitHistory: false })
                                                    onUpdateEnd && onUpdateEnd()
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
                                fill="transparent"
                                stroke="#9A9A9A"
                                strokeWidth="2"
                                className="group-hover:stroke-neutral-200 transition-colors"
                            />
                        </svg>
                    </div>
                )}

                {item.type === 'circle' && (
                    <div className="w-full h-full relative">
                        <DeleteButton />
                        <svg width="100%" height="100%" className="w-full h-full block">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="calc(50% - 2px)"
                                fill="transparent"
                                stroke="#9A9A9A"
                                strokeWidth="2"
                                className="group-hover:stroke-neutral-200 transition-colors"
                            />
                        </svg>
                    </div>
                )}

                {item.type === 'line' && (
                    <div className="w-full h-full flex items-center justify-center relative text-white">
                        <DeleteButton />
                        <svg width="100%" height="100%" className="overflow-visible">
                            <path
                                d={linePath}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="group-hover:text-neutral-300 transition-colors"
                            />
                        </svg>
                    </div>
                )}

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
                            <path
                                d={linePath}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                markerEnd={`url(#arrow-head-item-${item.id})`}
                                className="group-hover:text-neutral-300 transition-colors"
                            />
                        </svg>
                    </div>
                )}

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

                {showShapeResizeHandles && (
                    <>
                        <div
                            className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-white border border-black/60 cursor-nwse-resize z-50"
                            onPointerDown={(e) => startShapeResize('nw', e)}
                        />
                        <div
                            className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-white border border-black/60 cursor-nesw-resize z-50"
                            onPointerDown={(e) => startShapeResize('ne', e)}
                        />
                        <div
                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-full bg-white border border-black/60 cursor-nesw-resize z-50"
                            onPointerDown={(e) => startShapeResize('sw', e)}
                        />
                        <div
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full bg-white border border-black/60 cursor-nwse-resize z-50"
                            onPointerDown={(e) => startShapeResize('se', e)}
                        />
                    </>
                )}

                {showLineHandles && lineStart && lineEnd && lineMiddle && (
                    <>
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black/60 z-50 cursor-pointer"
                            style={{ left: lineStart.x - 6, top: lineStart.y - 6 }}
                            onPointerDown={(e) => startLineHandleDrag('start', e)}
                        />
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black/60 z-50 cursor-pointer"
                            style={{ left: lineMiddle.x - 6, top: lineMiddle.y - 6 }}
                            onPointerDown={(e) => startLineHandleDrag('middle', e)}
                        />
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black/60 z-50 cursor-pointer"
                            style={{ left: lineEnd.x - 6, top: lineEnd.y - 6 }}
                            onPointerDown={(e) => startLineHandleDrag('end', e)}
                        />
                    </>
                )}
            </div>
        </motion.div>
    )
}


