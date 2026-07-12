import { StateCreator } from 'zustand'
import { CanvasDocument, createEmptyCanvasDocument } from '@/features/canvas/types'

export interface CanvasSlice {
    canvasState: CanvasDocument
    setCanvasState: (
        canvasState: CanvasDocument | ((prev: CanvasDocument) => CanvasDocument)
    ) => void
}

export const createCanvasSlice: StateCreator<CanvasSlice> = (set) => ({
    canvasState: createEmptyCanvasDocument(),
    setCanvasState: (updater) =>
        set((state) => ({
            canvasState: typeof updater === 'function' ? updater(state.canvasState) : updater,
        })),
})
