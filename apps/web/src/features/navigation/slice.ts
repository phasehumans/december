import { StateCreator } from 'zustand'

import { ViewState } from '@/app/types'

export interface NavigationSlice {
    view: ViewState
    isMobileSidebarOpen: boolean
    isSuperCrewOpen: boolean
    /** which level the mobile menu sheet opens on: the menu, or straight into the inbox */
    mobileSheetStart: 'menu' | 'inbox'
    importState: {
        status: 'idle' | 'loading' | 'failed' | 'ready'
        message?: string | null
    }
    projectType: 'generated' | 'github' | 'zip'
    setView: (view: ViewState) => void
    setIsMobileSidebarOpen: (isOpen: boolean) => void
    setIsSuperCrewOpen: (isOpen: boolean) => void
    openMobileSheet: (start: 'menu' | 'inbox') => void
    setImportState: (state: NavigationSlice['importState']) => void
    setProjectType: (type: NavigationSlice['projectType']) => void
}

export const createNavigationSlice: StateCreator<NavigationSlice> = (set) => ({
    view: 'chat', // default view, though it might be overridden by router
    isMobileSidebarOpen: false,
    isSuperCrewOpen: false,
    mobileSheetStart: 'menu',
    importState: { status: 'idle', message: null },
    projectType: 'generated',
    setView: (view) => set({ view }),
    setIsMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
    setIsSuperCrewOpen: (isSuperCrewOpen) => set({ isSuperCrewOpen }),
    openMobileSheet: (mobileSheetStart) => set({ mobileSheetStart, isMobileSidebarOpen: true }),
    setImportState: (importState) => set({ importState }),
    setProjectType: (projectType) => set({ projectType }),
})
