import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

import { CanvasConnectionsLayer } from './CanvasConnectionsLayer'
import { CanvasItemComponent } from './CanvasItemComponent'
import { CanvasTempItemPreview } from './CanvasTempItemPreview'
import { CanvasToolbar } from './CanvasToolbar'

import type {
    CanvasConnection,
    CanvasDocument,
    CanvasItem,
    CanvasItemDraft,
    CanvasProps,
    CanvasUpdateOptions as UpdateOptions,
} from '@/features/canvas/types'

import { createEmptyCanvasDocument } from '@/features/canvas/types'

export interface CanvasRef {
    triggerImageUpload: () => void
}

import { useCanvasController } from '@/features/canvas/hooks/useCanvasController'

export const Canvas = forwardRef<CanvasRef, CanvasProps>((props, ref) => {
    const {
        isAuthenticated,
        onOpenAuth,
        document: canvasDocument,
        onDocumentChange,
        projectId,
    } = props
    const {
        items,
        connections,
        hasInteracted,
        history,
        historyStep,
        activeTool,
        setActiveTool,
        scale,
        setScale,
        selectedId,
        setSelectedId,
        pan,
        isPanning,
        isDrawing,
        tempItem,
        isErasing,
        connectionDraft,
        containerRef,
        undo,
        redo,
        markInteraction,
        handleAddItem,
        handleAddItems,
        handleRemoveItem,
        handleItemSelect,
        handleItemDrag,
        handleItemDragEnd,
        handleConnectStart,
        handleConnectEnd,
        getAnchorPoint,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        getTempFramePath,
        getDraftLinePoints,
        getConnectionPath,
        handleItemUpdate,
        handleItemUpdateEnd,
        buildSmoothPath,
        buildPolylinePath,
    } = useCanvasController(canvasDocument, onDocumentChange, ref)

    const baseGridSize = 24
    const baseDotSize = 1.5
    const currentGridSize = baseGridSize * (scale / 100)
    const currentDotSize = baseDotSize * (scale / 100)

    const isDrawCursorTool = ['frame', 'square', 'circle', 'line', 'arrow', 'pen', 'text'].includes(
        activeTool
    )

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full bg-[#1e1e1e] overflow-hidden ${activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : isDrawCursorTool ? 'cursor-crosshair' : ''}`}
            style={{
                backgroundImage: `radial-gradient(#3a3a3a ${currentDotSize}px, transparent ${currentDotSize}px)`,
                backgroundSize: `${currentGridSize}px ${currentGridSize}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`,
                ...(activeTool === 'eraser'
                    ? {
                          cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="rgba(255,255,255,0.3)" stroke="%23ffffff" stroke-width="1.5"/><circle cx="8" cy="8" r="7.5" fill="none" stroke="%23000000" stroke-width="0.75"/></svg>') 8 8, auto`,
                      }
                    : {}),
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            <div
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className="canvas-toolbar-container transition-all duration-200"
            >
                <CanvasToolbar
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    onAddItem={handleAddItem}
                    onAddItems={handleAddItems}
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
                    projectId={projectId}
                />
            </div>

            <div
                className={`absolute top-0 left-0 w-full h-full origin-top-left will-change-transform ${activeTool === 'hand' || isPanning ? 'pointer-events-none' : ''}`}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale / 100})` }}
                onClick={() => {
                    if (
                        activeTool === 'select' &&
                        !isPanning &&
                        !isDrawing &&
                        !connectionDraft &&
                        !isErasing
                    ) {
                        setSelectedId(null)
                    }
                }}
            >
                <CanvasConnectionsLayer
                    connections={connections}
                    connectionDraft={connectionDraft}
                    getAnchorPoint={getAnchorPoint}
                    getConnectionPath={getConnectionPath}
                />

                {items.map((item) => (
                    <CanvasItemComponent
                        key={item.id}
                        item={item}
                        scale={scale}
                        activeTool={activeTool}
                        isSelected={selectedId === item.id || item.parentId === selectedId}
                        onSelect={() => handleItemSelect(item.id)}
                        onRemove={() => handleRemoveItem(item.id)}
                        onDragging={(delta) => handleItemDrag(item.id, delta)}
                        onDragEnd={handleItemDragEnd}
                        onConnectStart={handleConnectStart}
                        onConnectEnd={handleConnectEnd}
                        onUpdate={(updates, options) => handleItemUpdate(item.id, updates, options)}
                        onUpdateEnd={handleItemUpdateEnd}
                    />
                ))}

                {tempItem && (
                    <CanvasTempItemPreview
                        tempItem={tempItem}
                        buildSmoothPath={buildSmoothPath}
                        buildPolylinePath={buildPolylinePath}
                        getDraftLinePoints={getDraftLinePoints}
                        getTempFramePath={getTempFramePath}
                    />
                )}
            </div>
        </div>
    )
})

export default Canvas
