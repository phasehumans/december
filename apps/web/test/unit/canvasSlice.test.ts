import { describe, it, expect } from 'bun:test'
import { create } from 'zustand'

import { createCanvasSlice, CanvasSlice } from '@/features/canvas/slice'

describe('Canvas Slice', () => {
    const useStore = create<CanvasSlice>()(createCanvasSlice)

    it('has correct initial state', () => {
        const state = useStore.getState()
        expect(state.canvasState).toBeDefined()
        // Assuming createEmptyCanvasDocument returns something like { type: 'doc', content: [] }
        // You can add more specific assertions here based on CanvasDocument structure.
    })

    it('setCanvasState updates state with object', () => {
        const newState = { type: 'doc', content: [{ type: 'paragraph' }] } as any
        useStore.getState().setCanvasState(newState)
        expect(useStore.getState().canvasState).toEqual(newState)
    })

    it('setCanvasState updates state with function', () => {
        const initialState = useStore.getState().canvasState
        const newState = { type: 'doc', content: [{ type: 'paragraph' }] } as any

        useStore.getState().setCanvasState((prev) => {
            expect(prev).toEqual(initialState)
            return newState
        })

        expect(useStore.getState().canvasState).toEqual(newState)
    })
})
