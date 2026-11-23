import { StateCreator } from 'zustand'

import { ViewState } from '@/app/types'

export type MobileSheetStart = 'menu' | 'inbox' | 'settings'

export interface NavigationSlice {
    view: ViewState
    isMobileSidebarOpen: boolean
    isSuperCrewOpen: boolean
    /** which level the phone menu sheet opens on: the menu, settings or the inbox */
    mobileSheetStart: MobileSheetStart
    importState: {
        status: 'idle' | 'loading' | 'failed' | 'ready'
        message?: string | null
    }
    projectType: 'generated' | 'github' | 'zip'
    setView: (view: ViewState) => void
    setIsMobileSidebarOpen: (isOpen: boolean) => void
    setIsSuperCrewOpen: (isOpen: boolean) => void
    openMobileSheet: (start: MobileSheetStart) => void
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
