import React from 'react'
import type { CanvasItem } from '@/features/canvas/types'

export const TEXT_FONT_SIZE = 20
export const TEXT_FONT = 'Inter, system-ui, sans-serif'

export const measureTextDimensions = (text: string) => {
    const div = document.createElement('div')
    div.style.position = 'absolute'
    div.style.visibility = 'hidden'
    div.style.whiteSpace = 'pre'
    div.style.fontSize = `${TEXT_FONT_SIZE}px`
    div.style.lineHeight = '1.5'
    div.style.fontFamily = TEXT_FONT
    div.style.fontWeight = '500'
    div.style.padding = '4px'
    div.textContent = text.endsWith('\n') ? text + ' ' : text || ' '
    document.body.appendChild(div)
    const width = div.offsetWidth
    const height = div.offsetHeight
    document.body.removeChild(div)
    return {
        width: Math.max(width, 10),
        height: Math.max(height, Math.ceil(TEXT_FONT_SIZE * 1.5)),
    }
}

export const getDefaultSizeByType = (type: CanvasItem['type']) => {
    if (type === 'square' || type === 'circle') return { width: 128, height: 128 }
    if (type === 'line' || type === 'arrow') return { width: 192, height: 48 }
    if (type === 'pen') return { width: 192, height: 96 }
    if (type === 'text') return { width: 10, height: 30 }
    if (type === 'frame') return { width: 384, height: 384 }
    if (type === 'image') return { width: 320, height: 288 }
    return { width: 120, height: 80 }
}

export const buildPolylinePath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return ''
    return points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')
}

export const buildSmoothPath = (points: { x: number; y: number }[]) => {
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

export const normalizeLinePoints = (absolutePoints: { x: number; y: number }[]) => {
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

interface UseCanvasItemControllerProps {
    item: CanvasItem
    isSelected: boolean
    onSelect: () => void
    onUpdate?: (updates: Partial<CanvasItem>, options?: { commitHistory?: boolean }) => void
    onUpdateEnd?: () => void
    onDragStart?: () => void
    onDragging?: (delta: { x: number; y: number }) => void
    onDragEnd?: () => void
    scale: number
    activeTool: string | null
}

export const useCanvasItemController = ({
    item,
    isSelected,
    onSelect,
    onUpdate,
    onUpdateEnd,
    onDragStart,
    onDragging,
    onDragEnd,
    scale,
    activeTool,
}: UseCanvasItemControllerProps) => {
    const isChild = !!item.parentId
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
    const [isEditing, setIsEditing] = React.useState(item.content === '')
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
            if (onUpdateEnd) {
                onUpdateEnd()
            }
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
            if (onUpdateEnd) {
                onUpdateEnd()
            }
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
        if (onDragStart) {
            onDragStart()
        }

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
        item.type !== 'pen' &&
        item.type !== 'text'

    return {
        isChild,
        isDropdownOpen,
        setIsDropdownOpen,
        isEditing,
        setIsEditing,
        isSelectMode,
        canTransform,
        startShapeResize,
        startLineHandleDrag,
        handlePointerDown,
        linePoints,
        linePath,
        lineStart,
        lineEnd,
        penPath,
        showShapeResizeHandles,
        showLineHandles,
        showSelectionContainer,
    }
}
