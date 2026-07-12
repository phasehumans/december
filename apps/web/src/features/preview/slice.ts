import { StateCreator } from 'zustand'
import { GeneratedProjectFile, PreviewSessionStatus } from '@/features/preview/types'
import { mapStoredFilesToGeneratedFiles } from '@/features/preview/utils'

export interface PreviewSlice {
    generatedFiles: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath: string | null
    previewSession: PreviewSessionStatus | null
    previewSessionError: string | null
    setGeneratedFiles: (files: Record<string, GeneratedProjectFile>) => void
    setActiveGeneratedFilePath: (path: string | null) => void
    setPreviewSession: (session: PreviewSessionStatus | null) => void
    setPreviewSessionError: (error: string | null) => void
    replaceGeneratedOutput: (files: Record<string, string>, preferredPath?: string | null) => void
    resetGeneratedOutput: () => void
    startGeneratedFile: (data: { path: string; purpose: string; generator: string }) => void
    appendGeneratedFileChunk: (path: string, chunk: string) => void
    completeGeneratedFile: (path: string) => void
    markGeneratedFileError: (path: string) => void
}

export const createPreviewSlice: StateCreator<PreviewSlice> = (set, get) => ({
    generatedFiles: {},
    activeGeneratedFilePath: null,
    previewSession: null,
    previewSessionError: null,
    setGeneratedFiles: (generatedFiles) => set({ generatedFiles }),
    setActiveGeneratedFilePath: (activeGeneratedFilePath) => set({ activeGeneratedFilePath }),
    setPreviewSession: (previewSession) => set({ previewSession }),
    setPreviewSessionError: (previewSessionError) => set({ previewSessionError }),
    replaceGeneratedOutput: (files, preferredPath) => {
        const paths = Object.keys(files)
        const nextActivePath =
            preferredPath && paths.includes(preferredPath)
                ? preferredPath
                : (paths[paths.length - 1] ?? null)

        get().setGeneratedFiles(mapStoredFilesToGeneratedFiles(files))
        get().setActiveGeneratedFilePath(nextActivePath)
    },
    resetGeneratedOutput: () => {
        get().setGeneratedFiles({})
        get().setActiveGeneratedFilePath(null)
    },
    startGeneratedFile: (data) => {
        get().setGeneratedFiles({
            ...get().generatedFiles,
            [data.path]: {
                path: data.path,
                content: get().generatedFiles[data.path]?.content ?? '',
                status: 'building',
                purpose: data.purpose,
                generator: data.generator,
            },
        })
        get().setActiveGeneratedFilePath(data.path)
    },
    appendGeneratedFileChunk: (path, chunk) => {
        get().setGeneratedFiles({
            ...get().generatedFiles,
            [path]: {
                path,
                content: `${get().generatedFiles[path]?.content ?? ''}${chunk}`,
                status: 'building',
                purpose: get().generatedFiles[path]?.purpose,
                generator: get().generatedFiles[path]?.generator,
            },
        })
    },
    completeGeneratedFile: (path) => {
        const current = get().generatedFiles[path]
        if (!current) return

        get().setGeneratedFiles({
            ...get().generatedFiles,
            [path]: {
                ...current,
                status: 'done',
            },
        })
    },
    markGeneratedFileError: (path) => {
        const current = get().generatedFiles[path]
        if (!current) return

        get().setGeneratedFiles({
            ...get().generatedFiles,
            [path]: {
                ...current,
                status: 'error',
            },
        })
    },
})
