import { describe, it, expect } from 'bun:test'
import { create } from 'zustand'

import { createNavigationSlice, NavigationSlice } from '@/features/navigation/slice'

describe('Navigation Slice', () => {
    // Helper to create a store with just the navigation slice
    const useTestStore = create<NavigationSlice>()((...a) => ({
        ...createNavigationSlice(...a),
    }))

    it('has correct initial state', () => {
        const state = useTestStore.getState()
        expect(state.view).toBe('chat')
        expect(state.isMobileSidebarOpen).toBe(false)
        expect(state.importState).toEqual({ status: 'idle', message: null })
        expect(state.projectType).toBe('generated')
    })

    it('setView updates the view', () => {
        useTestStore.getState().setView('canvas')
        expect(useTestStore.getState().view).toBe('canvas')
    })

    it('setIsMobileSidebarOpen updates the state', () => {
        useTestStore.getState().setIsMobileSidebarOpen(true)
        expect(useTestStore.getState().isMobileSidebarOpen).toBe(true)
    })

    it('setImportState updates the state', () => {
        useTestStore.getState().setImportState({ status: 'loading', message: 'Loading...' })
        expect(useTestStore.getState().importState).toEqual({
            status: 'loading',
            message: 'Loading...',
        })
    })

    it('setProjectType updates the state', () => {
        useTestStore.getState().setProjectType('github')
        expect(useTestStore.getState().projectType).toBe('github')
    })
})
