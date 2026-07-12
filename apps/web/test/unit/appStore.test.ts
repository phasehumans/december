import { describe, it, expect } from 'bun:test'
import { useAppStore } from '@/app/store'

describe('App Store', () => {
    it('should initialize with all combined slices', () => {
        const state = useStore.getState()

        // Auth Slice
        expect(state.isAuthenticated).toBe(false)
        expect(state.showAuthModal).toBe(false)

        // Canvas Slice
        expect(state.canvasState).toBeDefined()

        // Chat Slice
        expect(state.messages).toEqual([])

        // Navigation Slice
        expect(state.view).toBe('chat')

        // Preview Slice
        expect(state.generatedFiles).toEqual({})

        // Project Slice
        expect(state.activeProjectId).toBe(null)
    })
})

// For testing purposes, we use the already created useAppStore
const useStore = useAppStore
