import { StateCreator } from 'zustand'

import { ViewState } from '@/app/types'

export interface NavigationSlice {
    view: ViewState
    isMobileSidebarOpen: boolean
    importState: {
        status: 'idle' | 'loading' | 'failed' | 'ready'
        message?: string | null
    }
    projectType: 'generated' | 'github' | 'zip'
    setView: (view: ViewState) => void
    setIsMobileSidebarOpen: (isOpen: boolean) => void
    setImportState: (state: NavigationSlice['importState']) => void
    setProjectType: (type: NavigationSlice['projectType']) => void
}

export const createNavigationSlice: StateCreator<NavigationSlice> = (set) => ({
    view: 'chat', // default view, though it might be overridden by router
    isMobileSidebarOpen: false,
    importState: { status: 'idle', message: null },
    projectType: 'generated',
    setView: (view) => set({ view }),
    setIsMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
    setImportState: (importState) => set({ importState }),
    setProjectType: (projectType) => set({ projectType }),
})
