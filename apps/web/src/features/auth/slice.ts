import { StateCreator } from 'zustand'

export interface AuthSlice {
    isAuthenticated: boolean
    showAuthModal: boolean
    setIsAuthenticated: (isAuthenticated: boolean) => void
    setShowAuthModal: (show: boolean) => void
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
    isAuthenticated: false,
    showAuthModal: false,
    setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
    setShowAuthModal: (showAuthModal) => set({ showAuthModal }),
})
