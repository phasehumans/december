import { describe, it, expect } from 'bun:test'
import { create } from 'zustand'
import { createAuthSlice, AuthSlice } from '@/features/auth/slice'

describe('Auth Slice', () => {
    const useStore = create<AuthSlice>()(createAuthSlice)

    it('has correct initial state', () => {
        const state = useStore.getState()
        expect(state.isAuthenticated).toBe(false)
        expect(state.showAuthModal).toBe(false)
    })

    it('setIsAuthenticated updates the state', () => {
        useStore.getState().setIsAuthenticated(true)
        expect(useStore.getState().isAuthenticated).toBe(true)

        useStore.getState().setIsAuthenticated(false)
        expect(useStore.getState().isAuthenticated).toBe(false)
    })

    it('setShowAuthModal updates the state', () => {
        useStore.getState().setShowAuthModal(true)
        expect(useStore.getState().showAuthModal).toBe(true)

        useStore.getState().setShowAuthModal(false)
        expect(useStore.getState().showAuthModal).toBe(false)
    })
})
