import React from 'react'
import { motion } from 'framer-motion'
import { Type as TextIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { CanvasItem, CanvasItemComponentProps } from '@/features/canvas/types'
import { CanvasDeleteButton } from './CanvasDeleteButton'
import { CanvasFrameItem } from './CanvasFrameItem'
import { CanvasVectorItem } from './CanvasVectorItem'
import { CanvasResizeHandles } from './CanvasResizeHandles'

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
        const width = Math.max(item.width || defaults.width, 2)
        const height = Math.max(item.height || defaults.height, 2)
        return [
            { x: 2, y: height / 2 },
            { x: width - 2, y: height / 2 },
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
        handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se',
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

            if (handle.includes('e')) {
                width += dx
            }
            if (handle.includes('s')) {
                height += dy
            }
            if (handle.includes('w')) {
                x += dx
                width -= dx
            }
            if (handle.includes('n')) {
                y += dy
                height -= dy
            }

            if (width < MIN_SIZE) {
                if (handle.includes('w')) x -= MIN_SIZE - width
                width = MIN_SIZE
            }
            if (height < MIN_SIZE) {
                if (handle.includes('n')) y -= MIN_SIZE - height
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

    const linePoints = getLinePoints()
    const linePath = buildPolylinePath(linePoints)
    const lineStart = linePoints[0]
    const lineEnd = linePoints[linePoints.length - 1]
    const penPath = buildSmoothPath(item.points || [])

    const showShapeResizeHandles =
        canTransform && (item.type === 'frame' || item.type === 'square' || item.type === 'circle')
    const showLineHandles = canTransform && (item.type === 'line' || item.type === 'arrow')
    const showSelectionContainer =
        item.type !== 'frame' &&
        item.type !== 'square' &&
        item.type !== 'circle' &&
        item.type !== 'line' &&
        item.type !== 'arrow' &&
        item.type !== 'pen'

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
                (item.type === 'line' || item.type === 'arrow') &&
                    !item.width &&
                    'w-48 h-12 flex items-center',
                item.type === 'pen' && !item.width && 'w-48 h-24'
            )}
        >
            {showSelectionContainer && (
                <div
                    className={cn(
                        'absolute -inset-[3px] rounded-2xl border transition-all duration-200 pointer-events-none z-0',
                        isSelected
                            ? 'border-neutral-400/50 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] opacity-100'
                            : 'border-transparent opacity-0 group-hover:opacity-100 group-hover:border-white/10'
                    )}
                />
            )}

            <div className="relative z-10 h-full w-full">
                {item.type === 'note' && (
                    <div className="relative overflow-hidden rounded-xl border border-neutral-200/50 bg-[#FEF9C3] text-neutral-900 shadow-xl">
                        <CanvasDeleteButton onRemove={onRemove} />
                        <div className="flex min-h-[160px] flex-col p-4">
                            <textarea
                                placeholder="Type text..."
                                className="h-full w-full resize-none border-none bg-transparent text-sm font-medium leading-relaxed text-neutral-900 outline-none placeholder-neutral-500/50"
                                autoFocus
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                            <div className="mt-auto flex items-center gap-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500 opacity-50">
                                <TextIcon size={10} />
                                Text
                            </div>
                        </div>
                    </div>
                )}

                {item.type === 'text' && (
                    <div className="relative h-full w-full">
                        <CanvasDeleteButton onRemove={onRemove} />
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
                            className="h-full w-full resize-none border-none bg-transparent text-[22px] font-medium leading-tight text-[#E8E8E6] outline-none placeholder-neutral-500/70"
                        />
                    </div>
                )}

                {item.type === 'image' && (
                    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1C1C1E] shadow-xl ring-1 ring-black/40 transition-colors group-hover:border-neutral-700">
                        {!isChild && <CanvasDeleteButton onRemove={onRemove} />}
                        <div className="relative h-[65%] w-full overflow-hidden border-b border-white/5 bg-[#111] group/img">
                            <img
                                src={item.content}
                                alt=""
                                className="h-full w-full object-cover opacity-90 transition-opacity duration-300 group-hover/img:opacity-100"
                                draggable={false}
                            />
                            {isChild && <div className="absolute inset-0 bg-transparent" />}
                        </div>
                        <div className="flex flex-1 flex-col bg-[#222] p-3">
                            <textarea
                                className="h-full w-full resize-none bg-transparent text-[13px] leading-relaxed text-[#E8E8E6] placeholder-neutral-500/70 focus:outline-none font-sans"
                                placeholder="Describe how to use this image..."
                                onKeyDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                )}

                {item.type === 'link' && (
                    <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/10 bg-[#252423]">
                        <CanvasDeleteButton onRemove={onRemove} />
                        <span className="text-xs text-neutral-500">{item.content}</span>
                    </div>
                )}

                {item.type === 'frame' && (
                    <CanvasFrameItem
                        item={item}
                        isSelected={isSelected}
                        isDropdownOpen={isDropdownOpen}
                        setIsDropdownOpen={setIsDropdownOpen}
                        onRemove={onRemove}
                        onUpdate={onUpdate}
                        onUpdateEnd={onUpdateEnd}
                        onConnectStart={onConnectStart}
                        onConnectEnd={onConnectEnd}
                    />
                )}

                <CanvasVectorItem
                    item={item}
                    isSelected={isSelected}
                    linePath={linePath}
                    penPath={penPath}
                />

                <CanvasResizeHandles
                    showShapeResizeHandles={showShapeResizeHandles}
                    showLineHandles={showLineHandles}
                    lineStart={lineStart}
                    lineEnd={lineEnd}
                    onShapeHandleDown={startShapeResize}
                    onLineHandleDown={startLineHandleDrag}
                />
            </div>
        </motion.div>
    )
}
