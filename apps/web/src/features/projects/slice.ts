import type { BackendProjectVersionSummary } from '@/features/projects/api/project'
import type { StateCreator } from 'zustand'

export interface ProjectSlice {
    activeProjectId: string | null
    activeProjectName: string | null
    projectVersions: BackendProjectVersionSummary[]
    activeProjectVersionId: string | null
    isProjectOpening: boolean
    projectLoadError: string | null
    selectedModel: string
    setActiveProjectId: (id: string | null) => void
    setActiveProjectName: (name: string | null) => void
    setProjectVersions: (versions: BackendProjectVersionSummary[]) => void
    setActiveProjectVersionId: (id: string | null) => void
    setIsProjectOpening: (isOpening: boolean) => void
    setProjectLoadError: (error: string | null) => void
    setSelectedModel: (model: string) => void
}

export const createProjectSlice: StateCreator<ProjectSlice> = (set) => ({
    activeProjectId: null,
    activeProjectName: null,
    projectVersions: [],
    activeProjectVersionId: null,
    isProjectOpening: false,
    projectLoadError: null,
    selectedModel: localStorage.getItem('december_selected_model') || '',
    setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
    setActiveProjectName: (activeProjectName) => set({ activeProjectName }),
    setProjectVersions: (projectVersions) => set({ projectVersions }),
    setActiveProjectVersionId: (activeProjectVersionId) => set({ activeProjectVersionId }),
    setIsProjectOpening: (isProjectOpening) => set({ isProjectOpening }),
    setProjectLoadError: (projectLoadError) => set({ projectLoadError }),
    setSelectedModel: (selectedModel) => {
        set({ selectedModel })
        if (selectedModel) {
            localStorage.setItem('december_selected_model', selectedModel)
        } else {
            localStorage.removeItem('december_selected_model')
        }
    },
})
