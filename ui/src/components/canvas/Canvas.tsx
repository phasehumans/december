import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasItemComponent } from './CanvasItemComponent'
import type { CanvasItem, CanvasConnection } from '../../types'

export interface CanvasRef {
    triggerImageUpload: () => void
}

interface CanvasProps {
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

export const Canvas = forwardRef<CanvasRef, CanvasProps>((props, ref) => {
    const { isAuthenticated, onOpenAuth } = props
    const [items, setItems] = useState<CanvasItem[]>([])
    const [connections, setConnections] = useState<CanvasConnection[]>([])

    // Interaction State for Onboarding
    const [hasInteracted, setHasInteracted] = useState(false)

    // History State
    const [history, setHistory] = useState<
        { items: CanvasItem[]; connections: CanvasConnection[] }[]
    >([{ items: [], connections: [] }])
    const [historyStep, setHistoryStep] = useState(0)

    const [activeTool, setActiveTool] = useState('select')
    const [scale, setScale] = useState(100)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    // Pan state
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isPanning, setIsPanning] = useState(false)

    // Frame Drawing State
    const [isDrawing, setIsDrawing] = useState(false)
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
    const [tempFrame, setTempFrame] = useState<CanvasItem | null>(null)

    // Connection State
    const [connectionDraft, setConnectionDraft] = useState<{
        fromId: string
        fromSide: 'left' | 'right'
        toPoint?: { x: number; y: number }
    } | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)

    // Refs to access latest state inside non-react event listeners or stale closures
    const stateRef = useRef({ scale, pan, items, connections })

    // Update refs whenever state changes
    useEffect(() => {
        stateRef.current = { scale, pan, items, connections }
    }, [scale, pan, items, connections])

    // --- Interaction Marking ---
    const markInteraction = () => {
        if (!hasInteracted) {
            setHasInteracted(true)
        }
    }

    // --- History Management ---

    const addToHistory = (newItems: CanvasItem[], newConnections: CanvasConnection[]) => {
        // If we are not at the end of history, slice it
        const newHistory = history.slice(0, historyStep + 1)
        newHistory.push({
            items: JSON.parse(JSON.stringify(newItems)), // Deep copy
            connections: JSON.parse(JSON.stringify(newConnections)),
        })
        setHistory(newHistory)
        setHistoryStep(newHistory.length - 1)
    }

    const undo = () => {
        if (historyStep > 0) {
            const prevStep = historyStep - 1
            setHistoryStep(prevStep)
            setItems(history[prevStep]!.items)
            setConnections(history[prevStep]!.connections)
        }
    }

    const redo = () => {
        if (historyStep < history.length - 1) {
            const nextStep = historyStep + 1
            setHistoryStep(nextStep)
            setItems(history[nextStep]!.items)
            setConnections(history[nextStep]!.connections)
        }
    }

    // --- Zoom Handling ---

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                const { scale: currentScale, pan: currentPan } = stateRef.current

                const rect = container.getBoundingClientRect()
                const mouseX = e.clientX - rect.left
                const mouseY = e.clientY - rect.top

                const scaleFactor = currentScale / 100
                const worldX = (mouseX - currentPan.x) / scaleFactor
                const worldY = (mouseY - currentPan.y) / scaleFactor

                const SENSITIVITY = 0.003
                const zoomDelta = -e.deltaY * SENSITIVITY

                let newScale = currentScale * Math.exp(zoomDelta)
                newScale = Math.min(Math.max(newScale, 10), 500)

                const newScaleFactor = newScale / 100
                const newPanX = mouseX - worldX * newScaleFactor
                const newPanY = mouseY - worldY * newScaleFactor

                setScale(newScale)
                setPan({ x: newPanX, y: newPanY })
            }
        }

        container.addEventListener('wheel', onWheel, { passive: false })
        return () => {
            container.removeEventListener('wheel', onWheel)
        }
    }, [])

    // --- Actions ---

    const handleAddItem = (type: CanvasItem['type'], content?: string) => {
        markInteraction()
        const viewportCenterX = window.innerWidth / 2
        const viewportCenterY = window.innerHeight / 2

        const centerX = (viewportCenterX - pan.x) / (scale / 100)
        const centerY = (viewportCenterY - pan.y) / (scale / 100)

        const jitter = type !== 'link' ? Math.random() * 40 - 20 : 0

        const finalX = centerX + jitter - (type === 'image' || type === 'link' ? 130 : 50)
        const finalY = centerY + jitter - (type === 'image' || type === 'link' ? 120 : 50)

        if (type === 'link' && content) {
            const newItem: CanvasItem = {
                id: Date.now().toString(),
                type: 'image',
                x: finalX,
                y: finalY,
                content: `https://placehold.co/600x400/1C1C1E/FFFFFF?text=${encodeURIComponent(content)}&font=inter`,
                width: 260,
                height: 240,
            }
            const newItems = [...items, newItem]
            setItems(newItems)
            setSelectedId(newItem.id)
            addToHistory(newItems, connections)
            return
        }

        // For Frame, we don't add immediately. The user must drag to create.
        if (type === 'frame') {
            setActiveTool('frame')
            return
        }

        const newItem: CanvasItem = {
            id: Date.now().toString(),
            type,
            x: finalX,
            y: finalY,
            content,
        }
        const newItems = [...items, newItem]
        setItems(newItems)
        setSelectedId(newItem.id)
        addToHistory(newItems, connections)
    }

    useImperativeHandle(ref, () => ({
        triggerImageUpload: () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = (e) => {
                markInteraction()
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) {
                    const reader = new FileReader()
                    reader.onload = (evt) => {
                        if (evt.target?.result) {
                            handleAddItem('image', evt.target.result as string)
                        }
                    }
                    reader.readAsDataURL(file)
                }
            }
            input.click()
        },
    }))

    const handleRemoveItem = (id: string) => {
        markInteraction()
        const itemToRemove = items.find((i) => i.id === id)
        if (!itemToRemove) return

        let newItems: CanvasItem[]
        let newConnections = connections

        if (itemToRemove.type === 'frame') {
            newItems = items.filter((item) => item.id !== id && item.parentId !== id)
            newConnections = connections.filter((c) => c.from !== id && c.to !== id)
        } else {
            newItems = items.filter((item) => item.id !== id)
            // Also remove connections to/from this item
            newConnections = connections.filter((c) => c.from !== id && c.to !== id)
        }

        setItems(newItems)
        setConnections(newConnections)
        addToHistory(newItems, newConnections)

        if (selectedId === id) setSelectedId(null)
    }

    const handleItemSelect = (id: string) => {
        // Selecting an item is not considered a "drawing" interaction that hides hints
        if (activeTool === 'hand' || activeTool === 'frame') return
        if (connectionDraft) return // Don't select if connecting

        const item = items.find((i) => i.id === id)
        if (item?.parentId) {
            setSelectedId(item.parentId)
        } else {
            setSelectedId(id)
        }
    }

    const handleItemDrag = (id: string, delta: { x: number; y: number }) => {
        markInteraction() // Moving items hides hints
        setItems((prev) =>
            prev.map((item) => {
                if (item.id === id) {
                    return { ...item, x: item.x + delta.x, y: item.y + delta.y }
                }
                if (item.parentId === id) {
                    return { ...item, x: item.x + delta.x, y: item.y + delta.y }
                }
                return item
            })
        )
    }

    const handleItemDragEnd = () => {
        markInteraction()
        // When drag ends, save the current state to history.
        // We must use the ref to get the latest state because of closure staleness in the ItemComponent callback.
        addToHistory(stateRef.current.items, stateRef.current.connections)
    }

    // --- Connection Handlers ---

    const handleConnectStart = (itemId: string, side: 'left' | 'right', e: React.PointerEvent) => {
        markInteraction()
        e.stopPropagation()
        e.preventDefault()
        const coords = getCanvasCoordinates(e)
        setConnectionDraft({
            fromId: itemId,
            fromSide: side,
            toPoint: coords,
        })
    }

    const handleConnectEnd = (itemId: string, side: 'left' | 'right') => {
        markInteraction()
        if (connectionDraft) {
            if (connectionDraft.fromId !== itemId) {
                const newConnection: CanvasConnection = {
                    id: Date.now().toString(),
                    from: connectionDraft.fromId,
                    to: itemId,
                    fromSide: connectionDraft.fromSide,
                    toSide: side,
                }
                const newConnections = [...connections, newConnection]
                setConnections(newConnections)
                addToHistory(items, newConnections)
            }
            setConnectionDraft(null)
        }
    }

    // Helper to get anchor point coordinates
    const getAnchorPoint = (itemId: string, side: 'left' | 'right') => {
        const item = items.find((i) => i.id === itemId)
        if (!item) return { x: 0, y: 0 }

        const w = item.width || (item.type === 'frame' ? 320 : 100)
        const h = item.height || (item.type === 'frame' ? 320 : 100)

        // Calculate vertical center
        const cy = item.y + h / 2

        if (side === 'left') {
            return { x: item.x, y: cy }
        } else {
            return { x: item.x + w, y: cy }
        }
    }

    // Background and Grid Calculation
    const baseGridSize = 24
    const baseDotSize = 1.5
    const currentGridSize = baseGridSize * (scale / 100)
    const currentDotSize = baseDotSize * (scale / 100)

    // --- Interaction Handlers ---

    const getCanvasCoordinates = (e: React.PointerEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 }
        const rect = containerRef.current.getBoundingClientRect()
        const scaleFactor = scale / 100
        return {
            x: (e.clientX - rect.left - pan.x) / scaleFactor,
            y: (e.clientY - rect.top - pan.y) / scaleFactor,
        }
    }

    const handlePointerDown = (e: React.PointerEvent) => {
        // 1. Pan Tool or Middle Click
        if (activeTool === 'hand' || e.button === 1) {
            setIsPanning(true)
            e.preventDefault()
            return
        }

        // 2. Frame Tool - Start Drawing
        if (activeTool === 'frame') {
            markInteraction() // Start drawing - hides hints
            e.preventDefault()
            e.stopPropagation() // Prevent selecting other items beneath
            const coords = getCanvasCoordinates(e)
            setDragStart(coords)
            setIsDrawing(true)
            // Create a temp frame with 0 size
            setTempFrame({
                id: 'temp-frame',
                type: 'frame',
                x: coords.x,
                y: coords.y,
                width: 0,
                height: 0,
                content: 'Custom',
            })
            return
        }
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        const coords = getCanvasCoordinates(e)

        // Connection Draft Update
        if (connectionDraft) {
            setConnectionDraft((prev) => (prev ? { ...prev, toPoint: coords } : null))
            return
        }

        // Panning
        if (isPanning) {
            setPan((prev) => ({
                x: prev.x + e.movementX,
                y: prev.y + e.movementY,
            }))
            return
        }

        // Drawing Frame
        if (isDrawing && dragStart && tempFrame) {
            const width = coords.x - dragStart.x
            const height = coords.y - dragStart.y

            setTempFrame((prev) =>
                prev
                    ? {
                          ...prev,
                          width: width,
                          height: height,
                      }
                    : null
            )
        }
    }

    const handlePointerUp = () => {
        if (connectionDraft) {
            setConnectionDraft(null) // Cancel draft if dropped on empty space
        }

        if (isPanning) {
            setIsPanning(false)
        }

        if (isDrawing && tempFrame) {
            // Normalize geometry (handle negative width/height)
            const finalX =
                tempFrame.width && tempFrame.width < 0 ? tempFrame.x + tempFrame.width : tempFrame.x
            const finalY =
                tempFrame.height && tempFrame.height < 0
                    ? tempFrame.y + tempFrame.height
                    : tempFrame.y
            const finalWidth = Math.abs(tempFrame.width || 0)
            const finalHeight = Math.abs(tempFrame.height || 0)

            // Only create if it has some size
            if (finalWidth > 50 && finalHeight > 50) {
                const newItem: CanvasItem = {
                    ...tempFrame,
                    id: Date.now().toString(),
                    x: finalX,
                    y: finalY,
                    width: finalWidth,
                    height: finalHeight,
                }
                const newItems = [...items, newItem]
                setItems(newItems)
                addToHistory(newItems, connections)
                setSelectedId(newItem.id)
            }

            setIsDrawing(false)
            setDragStart(null)
            setTempFrame(null)
            setActiveTool('select') // Switch back to select after drawing
        }
    }

    // Helper to generate the folder path for the temporary frame
    const getTempFramePath = (w: number, h: number) => {
        const width = Math.abs(w)
        const height = Math.abs(h)
        const radius = 8
        const tabHeight = 32
        const tabWidth = 120

        return `
      M 0 ${radius} 
      Q 0 0 ${radius} 0 
      L ${tabWidth - radius} 0 
      Q ${tabWidth} 0 ${tabWidth} ${radius} 
      L ${tabWidth} ${tabHeight} 
      L ${width - radius} ${tabHeight} 
      Q ${width} ${tabHeight} ${width} ${tabHeight + radius} 
      L ${width} ${height - radius} 
      Q ${width} ${height} ${width - radius} ${height} 
      L ${radius} ${height} 
      Q 0 ${height} 0 ${height - radius} 
      Z
    `
    }

    // Generate Path for Connections (Curved Line)
    const getConnectionPath = (x1: number, y1: number, x2: number, y2: number) => {
        const dist = Math.abs(x2 - x1)
        const cp1x = x1 + dist * 0.5
        const cp2x = x2 - dist * 0.5
        return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`
    }

    const handleItemUpdate = (id: string, updates: Partial<CanvasItem>) => {
        setItems((prev) =>
            prev.map((item) => {
                if (item.id === id) {
                    return { ...item, ...updates }
                }
                return item
            })
        )
        addToHistory(items, connections)
    }

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full bg-[#1e1e1e] overflow-hidden ${activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : activeTool === 'frame' ? 'cursor-crosshair' : ''}`}
            style={{
                backgroundImage: `radial-gradient(#3a3a3a ${currentDotSize}px, transparent ${currentDotSize}px)`,
                backgroundSize: `${currentGridSize}px ${currentGridSize}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            <CanvasToolbar
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                onAddItem={handleAddItem}
                scale={scale}
                setScale={setScale}
                onUndo={undo}
                onRedo={redo}
                canUndo={historyStep > 0}
                canRedo={historyStep < history.length - 1}
                hasInteracted={hasInteracted}
                onInteract={markInteraction}
                isAuthenticated={isAuthenticated}
                onOpenAuth={onOpenAuth}
            />

            {/* Canvas Content Layer */}
            <div
                className="absolute top-0 left-0 w-full h-full origin-top-left will-change-transform"
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale / 100})`,
                }}
                onClick={() => {
                    if (
                        activeTool !== 'hand' &&
                        activeTool !== 'frame' &&
                        !isPanning &&
                        !isDrawing &&
                        !connectionDraft
                    ) {
                        setSelectedId(null)
                    }
                }}
            >
                {/* Connections Layer (Below Items) */}
                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-0">
                    <defs>
                        {/* Arrowhead Marker (End) */}
                        <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="7"
                            refX="9"
                            refY="3.5"
                            orient="auto"
                        >
                            <polygon points="0 0, 10 3.5, 0 7" fill="#A09F9D" />
                        </marker>
                        {/* Circle Marker (Start) */}
                        <marker
                            id="circle-marker"
                            markerWidth="8"
                            markerHeight="8"
                            refX="4"
                            refY="4"
                            orient="auto"
                        >
                            <circle cx="4" cy="4" r="2.5" fill="#A09F9D" />
                        </marker>
                    </defs>
                    {connections.map((conn) => {
                        const start = getAnchorPoint(conn.from, conn.fromSide)
                        const end = getAnchorPoint(conn.to, conn.toSide)
                        return (
                            <path
                                key={conn.id}
                                d={getConnectionPath(start.x, start.y, end.x, end.y)}
                                fill="none"
                                stroke="#A09F9D"
                                strokeWidth="2"
                                markerStart="url(#circle-marker)"
                                markerEnd="url(#arrowhead)"
                                className="opacity-80"
                            />
                        )
                    })}
                    {connectionDraft && connectionDraft.toPoint && (
                        <path
                            d={getConnectionPath(
                                getAnchorPoint(connectionDraft.fromId, connectionDraft.fromSide).x,
                                getAnchorPoint(connectionDraft.fromId, connectionDraft.fromSide).y,
                                connectionDraft.toPoint.x,
                                connectionDraft.toPoint.y
                            )}
                            fill="none"
                            stroke="#A09F9D"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                            markerStart="url(#circle-marker)"
                            markerEnd="url(#arrowhead)"
                            className="opacity-60"
                        />
                    )}
                </svg>

                {items.map((item) => (
                    <CanvasItemComponent
                        key={item.id}
                        item={item}
                        scale={scale}
                        isSelected={selectedId === item.id || item.parentId === selectedId}
                        onSelect={() => handleItemSelect(item.id)}
                        onRemove={() => handleRemoveItem(item.id)}
                        onDragging={(delta) => handleItemDrag(item.id, delta)}
                        onDragEnd={handleItemDragEnd}
                        onConnectStart={handleConnectStart}
                        onConnectEnd={handleConnectEnd}
                        onUpdate={(updates) => handleItemUpdate(item.id, updates)}
                    />
                ))}

                {/* Temporary Frame being drawn */}
                {tempFrame && (
                    <div
                        style={{
                            position: 'absolute',
                            left:
                                tempFrame.width && tempFrame.width < 0
                                    ? tempFrame.x + tempFrame.width
                                    : tempFrame.x,
                            top:
                                tempFrame.height && tempFrame.height < 0
                                    ? tempFrame.y + tempFrame.height
                                    : tempFrame.y,
                            width: Math.abs(tempFrame.width || 0),
                            height: Math.abs(tempFrame.height || 0),
                        }}
                        className="pointer-events-none z-50 opacity-50"
                    >
                        <svg width="100%" height="100%" className="overflow-visible">
                            <path
                                d={getTempFramePath(
                                    tempFrame.width || 100,
                                    tempFrame.height || 100
                                )}
                                fill="rgba(255,255,255,0.05)"
                                stroke="#AAA"
                                strokeWidth="2"
                                strokeDasharray="8 6"
                            />
                        </svg>
                    </div>
                )}

                {activeTool === 'hand' && (
                    <div className="absolute -inset-[5000px] z-50 bg-transparent" />
                )}
            </div>
        </div>
    )
})

export default Canvas
