import type { ComponentType, PointerEvent } from 'react'

export type CanvasAssetSource = 'temporary' | 'project'
export type CanvasAssetKind = 'upload' | 'web-clip'

export interface CanvasPoint {
    x: number
    y: number
}

export interface CanvasItem {
    id: string
    type:
        | 'note'
        | 'image'
        | 'link'
        | 'frame'
        | 'square'
        | 'circle'
        | 'line'
        | 'arrow'
        | 'pen'
        | 'text'
    x: number
    y: number
    width?: number
    height?: number
    content?: string
    color?: string
    points?: CanvasPoint[]
    parentId?: string
    assetKey?: string
    assetSource?: CanvasAssetSource
    assetContentType?: string
    assetKind?: CanvasAssetKind
}

export interface CanvasItemDraft extends Omit<CanvasItem, 'id' | 'x' | 'y'> {
    type: CanvasItem['type']
}

export interface CanvasConnection {
    id: string
    from: string
    to: string
    fromSide: 'left' | 'right'
    toSide: 'left' | 'right'
}

export interface CanvasDocument {
    items: CanvasItem[]
    connections: CanvasConnection[]
    pan: CanvasPoint
    scale: number
    hasInteracted: boolean
}

export const createEmptyCanvasDocument = (): CanvasDocument => ({
    items: [],
    connections: [],
    pan: { x: 0, y: 0 },
    scale: 100,
    hasInteracted: false,
})

export interface CanvasRef {
    triggerImageUpload: () => void
}

export interface CanvasProps {
    isAuthenticated?: boolean
    onOpenAuth?: () => void
    document?: CanvasDocument
    onDocumentChange?: (document: CanvasDocument) => void
    projectId?: string | null
}

export interface CanvasUpdateOptions {
    commitHistory?: boolean
}

export interface ConnectionDraft {
    fromId: string
    fromSide: 'left' | 'right'
    toPoint?: CanvasPoint
}

export interface CanvasConnectionsLayerProps {
    connections: CanvasConnection[]
    connectionDraft: ConnectionDraft | null
    getAnchorPoint: (itemId: string, side: 'left' | 'right') => CanvasPoint
    getConnectionPath: (x1: number, y1: number, x2: number, y2: number) => string
}

export interface CanvasDeleteButtonProps {
    onRemove: () => void
}

export interface CanvasFrameItemProps {
    item: CanvasItem
    isSelected: boolean
    isDropdownOpen: boolean
    setIsDropdownOpen: (isOpen: boolean) => void
    onRemove: () => void
    onUpdate?: (updates: Partial<CanvasItem>, options?: CanvasUpdateOptions) => void
    onUpdateEnd?: () => void
    onConnectStart?: (itemId: string, side: 'left' | 'right', event: PointerEvent) => void
    onConnectEnd?: (itemId: string, side: 'left' | 'right') => void
}

export interface CanvasItemComponentProps {
    item: CanvasItem
    isSelected: boolean
    onSelect: () => void
    onRemove: () => void
    onDragging?: (delta: CanvasPoint) => void
    onDragStart?: () => void
    onDragEnd?: () => void
    onConnectStart?: (itemId: string, side: 'left' | 'right', event: PointerEvent) => void
    onConnectEnd?: (itemId: string, side: 'left' | 'right') => void
    onUpdate?: (updates: Partial<CanvasItem>, options?: CanvasUpdateOptions) => void
    onUpdateEnd?: () => void
    scale: number
    activeTool?: string
}

export type ShapeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
export type LineHandle = 'start' | 'end'

export interface CanvasResizeHandlesProps {
    showShapeResizeHandles: boolean
    showLineHandles: boolean
    lineStart?: CanvasPoint
    lineEnd?: CanvasPoint
    onShapeHandleDown: (handle: ShapeHandle, event: PointerEvent<HTMLDivElement>) => void
    onLineHandleDown: (handle: LineHandle, event: PointerEvent<HTMLDivElement>) => void
}

export interface CanvasTempItemPreviewProps {
    tempItem: CanvasItem
    buildSmoothPath: (points: CanvasPoint[]) => string
    buildPolylinePath: (points: CanvasPoint[]) => string
    getDraftLinePoints: (item: CanvasItem) => CanvasPoint[]
    getTempFramePath: (width: number, height: number) => string
}

export interface CanvasToolbarProps {
    activeTool: string
    setActiveTool: (tool: string) => void
    onAddItem: (type: CanvasItem['type'], content?: string) => void
    onAddItems: (items: CanvasItemDraft[]) => void
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
    projectId?: string | null
}

export interface CanvasVectorItemProps {
    item: CanvasItem
    isSelected: boolean
    linePath: string
    penPath: string
}

export interface ToolButtonProps {
    icon: ComponentType<{
        className?: string
        size?: number | string
        strokeWidth?: number | string
    }>
    label: string
    isActive?: boolean
    onClick?: () => void
    disabled?: boolean
}
