import { StateCreator } from 'zustand'

import {
    GeneratedProjectFile,
    PreviewSessionStatus,
    SessionPlan,
    SessionTestReport,
    BrowserViewportData,
} from '@/features/preview/types'
import { mapStoredFilesToGeneratedFiles } from '@/features/preview/utils'

export interface PreviewSlice {
    generatedFiles: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath: string | null
    previewSession: PreviewSessionStatus | null
    previewSessionError: string | null
    gitDiff: string | null
    gitStatus: string | null
    pullRequest: any | null
    sessionPlan: SessionPlan | null
    testReport: SessionTestReport | null
    desktopViewport: BrowserViewportData | null
    setGeneratedFiles: (files: Record<string, GeneratedProjectFile>) => void
    setActiveGeneratedFilePath: (path: string | null) => void
    setPreviewSession: (session: PreviewSessionStatus | null) => void
    setPreviewSessionError: (error: string | null) => void
    setGitDiff: (gitDiff: string | null) => void
    setGitStatus: (gitStatus: string | null) => void
    setPullRequest: (pullRequest: any | null) => void
    setSessionPlan: (sessionPlan: SessionPlan | null) => void
    setTestReport: (testReport: SessionTestReport | null) => void
    setDesktopViewport: (desktopViewport: BrowserViewportData | null) => void
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
    gitDiff: null,
    gitStatus: null,
    pullRequest: null,
    sessionPlan: null,
    testReport: null,
    desktopViewport: null,
    setGeneratedFiles: (generatedFiles) => set({ generatedFiles }),
    setActiveGeneratedFilePath: (activeGeneratedFilePath) => set({ activeGeneratedFilePath }),
    setPreviewSession: (previewSession) => set({ previewSession }),
    setPreviewSessionError: (previewSessionError) => set({ previewSessionError }),
    setGitDiff: (gitDiff) => set({ gitDiff }),
    setGitStatus: (gitStatus) => set({ gitStatus }),
    setPullRequest: (pullRequest) => set({ pullRequest }),
    setSessionPlan: (sessionPlan) => set({ sessionPlan }),
    setTestReport: (testReport) => set({ testReport }),
    setDesktopViewport: (desktopViewport) => set({ desktopViewport }),
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
        get().setGitDiff(null)
        get().setGitStatus(null)
        get().setPullRequest(null)
        get().setSessionPlan(null)
        get().setTestReport(null)
        get().setDesktopViewport(null)
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
