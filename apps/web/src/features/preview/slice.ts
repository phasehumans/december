import { StateCreator } from 'zustand'
import { GeneratedProjectFile, PreviewSessionStatus } from '@/features/preview/types'

export interface PreviewSlice {
    generatedFiles: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath: string | null
    previewSession: PreviewSessionStatus | null
    previewSessionError: string | null
    setGeneratedFiles: (files: Record<string, GeneratedProjectFile>) => void
    setActiveGeneratedFilePath: (path: string | null) => void
    setPreviewSession: (session: PreviewSessionStatus | null) => void
    setPreviewSessionError: (error: string | null) => void
}

export const createPreviewSlice: StateCreator<PreviewSlice> = (set) => ({
    generatedFiles: {},
    activeGeneratedFilePath: null,
    previewSession: null,
    previewSessionError: null,
    setGeneratedFiles: (generatedFiles) => set({ generatedFiles }),
    setActiveGeneratedFilePath: (activeGeneratedFilePath) => set({ activeGeneratedFilePath }),
    setPreviewSession: (previewSession) => set({ previewSession }),
    setPreviewSessionError: (previewSessionError) => set({ previewSessionError }),
})
