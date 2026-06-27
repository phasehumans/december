import { useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import type { ViewState } from '@/app/types'
import type { Message } from '@/features/chat/types'
import type {
    GeneratedProjectFile,
    OutputOperation,
    PreviewRuntimeError,
    PreviewSelectedElement,
    PreviewSessionStatus,
} from '@/features/preview/types'

import { mapBackendProjectToUIProject } from '@/app/mapProject'
import { getPathForView, getViewForPath, toProjectSlug } from '@/app/types'
import { canvasAPI } from '@/features/canvas/api'
import { createEmptyCanvasDocument, type CanvasDocument } from '@/features/canvas/types'
import {
    generationAPI,
    type AppliedProjectChangeResult,
    type GenerationStreamEvent,
} from '@/features/generation/api/generation'
import { importsAPI, type ProjectImportStatus } from '@/features/home/api'
import { previewAPI } from '@/features/preview/api'
import { profileAPI } from '@/features/profile/api/profile'
import {
    projectAPI,
    type BackendProjectDetail,
    type BackendProjectMessage,
    type BackendProjectVersionSummary,
} from '@/features/projects/api/project'
import { refreshAuthSession } from '@/shared/api/client'

const getUserFacingGenerationError = (message: string) => {
    const normalizedMessage = message.toLowerCase()

    if (normalizedMessage.includes('sign in')) {
        return 'Please sign in and try again.'
    }

    if (normalizedMessage.includes('implementation plan')) {
        return "I couldn't turn that request into a reliable implementation plan. Try again or simplify the prompt to the essential pages and flows."
    }

    if (normalizedMessage.includes('understand the request')) {
        return "I couldn't understand the request clearly enough to start the project. Try rephrasing it with the main pages, style, and core features."
    }

    if (normalizedMessage.includes('edit agent')) {
        return 'I hit an issue while applying that change. Try again with a narrower follow-up request.'
    }

    if (normalizedMessage.includes('fix agent')) {
        return 'I found the preview error but could not repair it automatically. Try a manual follow-up edit instead.'
    }

    if (
        normalizedMessage.includes('project files') ||
        normalizedMessage.includes('retry the build')
    ) {
        return 'I started the build but hit an issue while generating the project files. Please retry the build.'
    }

    if (
        normalizedMessage.includes('connection was interrupted') ||
        normalizedMessage.includes('failed to fetch') ||
        normalizedMessage.includes('network') ||
        normalizedMessage.includes('stream body is missing')
    ) {
        return 'The generation connection was interrupted. Please try again.'
    }

    return 'Something went wrong while generating this project. Please try again.'
}

const mapBackendMessageToUIMessage = (message: BackendProjectMessage): Message => {
    const isAssistant = message.role !== 'USER' && message.role !== 'SYSTEM'
    let thoughts: string | undefined = undefined
    let plan: string | undefined = undefined
    let summary: string | undefined = undefined

    if (isAssistant && message.content) {
        if (message.content.includes('### Project Metadata')) {
            const index = message.content.indexOf('### Project Metadata')
            thoughts = message.content.slice(0, index).trim()
            plan = message.content.slice(index).trim()
            summary = ''
        } else {
            const parts = message.content.split('\n\n')
            if (parts.length > 1) {
                thoughts = parts[0]
                plan = parts.slice(1).join('\n\n')
                summary = '' // We don't use summary anymore
            } else {
                plan = message.content
                summary = ''
            }
        }
    }

    return {
        id: message.id,
        role: message.role === 'USER' ? 'user' : message.role === 'SYSTEM' ? 'system' : 'assistant',
        content: message.content,
        type: 'text',
        status: message.status ?? 'done',
        thoughts,
        plan,
        summary,
    }
}

const mapStoredFilesToGeneratedFiles = (files: Record<string, string>) =>
    Object.fromEntries(
        Object.entries(files).map(([path, content]) => [
            path,
            {
                path,
                content,
                status: 'done' as const,
            },
        ])
    )

const getImportStatusMessage = (status: ProjectImportStatus) => {
    if (status.errorMessage) return status.errorMessage
    if (status.status === 'PENDING') return 'Queued for import'
    if (status.status === 'VALIDATING') return 'Extracting project archive'
    if (status.status === 'UPLOADING') return 'Uploading project files'
    if (status.status === 'STARTING_RUNTIME') return 'Starting preview runtime'
    if (status.status === 'READY') return 'Preview is ready'
    return 'Import failed'
}

export const useAppController = () => {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const location = useLocation()

    const view = getViewForPath(location.pathname)
    const [messages, setMessages] = React.useState<Message[]>([])
    const [generatedFiles, setGeneratedFiles] = React.useState<
        Record<string, GeneratedProjectFile>
    >({})
    const [activeGeneratedFilePath, setActiveGeneratedFilePathState] = React.useState<
        string | null
    >(null)
    const [generationPhase, setGenerationPhase] = React.useState<
        'thinking' | 'building' | 'done' | null
    >(null)
    const [activeOperation, setActiveOperation] = React.useState<OutputOperation | null>(null)
    const [currentGenerationFilePaths, setCurrentGenerationFilePaths] = React.useState<string[]>([])

    const activeFilesToDisplay = React.useMemo(() => {
        if (currentGenerationFilePaths.length === 0) {
            return generatedFiles
        }
        const filtered: Record<string, GeneratedProjectFile> = {}
        for (const path of currentGenerationFilePaths) {
            if (generatedFiles[path]) {
                filtered[path] = generatedFiles[path]
            }
        }
        return filtered
    }, [generatedFiles, currentGenerationFilePaths])

    const [projectType, setProjectType] = React.useState<'generated' | 'github' | 'zip'>(
        'generated'
    )
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [isAuthenticated, setIsAuthenticated] = React.useState(false)
    const [showAuthModal, setShowAuthModal] = React.useState(false)
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false)
    const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null)
    const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null)
    const [canvasState, setCanvasState] = React.useState<CanvasDocument>(() =>
        createEmptyCanvasDocument()
    )
    const [selectedModel, setSelectedModel] = React.useState<string>(() => {
        return localStorage.getItem('december_selected_model') || ''
    })
    const lastSavedCanvasRef = React.useRef<string>('')
    const [projectVersions, setProjectVersions] = React.useState<BackendProjectVersionSummary[]>([])
    const [activeProjectVersionId, setActiveProjectVersionId] = React.useState<string | null>(null)
    const [isProjectOpening, setIsProjectOpening] = React.useState(false)
    const [projectLoadError, setProjectLoadError] = React.useState<string | null>(null)
    const [previewSession, setPreviewSession] = React.useState<PreviewSessionStatus | null>(null)
    const [previewSessionError, setPreviewSessionError] = React.useState<string | null>(null)
    const [importState, setImportState] = React.useState<{
        status: 'idle' | 'loading' | 'failed' | 'ready'
        message?: string | null
    }>({ status: 'idle', message: null })
    const generationAbortControllerRef = React.useRef<AbortController | null>(null)
    const activeAssistantMessageIdRef = React.useRef<string | null>(null)
    const activeGeneratedFilePathRef = React.useRef<string | null>(null)
    const outputOriginViewRef = React.useRef<ViewState>('chat')
    const lastAutoFixSignatureRef = React.useRef<string | null>(null)

    React.useEffect(() => {
        let isMounted = true

        const restoreSession = async () => {
            const refreshed = await refreshAuthSession()

            if (!isMounted || !refreshed) {
                return
            }

            setIsAuthenticated(true)
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        }

        void restoreSession()

        return () => {
            isMounted = false
        }
    }, [queryClient])

    const {
        data: projects = [],
        isLoading: isProjectsLoading,
        isFetching: isProjectsFetching,
        error: projectsError,
    } = useQuery({
        queryKey: ['projects'],
        queryFn: projectAPI.getProjects,
        enabled: isAuthenticated,
        placeholderData: (previousData) => previousData,
        select: (backendProjects) =>
            [...backendProjects]
                .sort((a, b) => {
                    const createdAtDiff =
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

                    if (createdAtDiff !== 0) {
                        return createdAtDiff
                    }

                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
                })
                .map(mapBackendProjectToUIProject),
    })

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: isAuthenticated,
    })

    const playNotificationSound = React.useCallback(
        (type: 'first' | 'followup') => {
            const preference = profile?.generationSound ?? 'FIRST_GENERATION'

            if (preference === 'NEVER') {
                return
            }

            if (preference === 'FIRST_GENERATION' && type !== 'first') {
                return
            }

            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext
                if (!AudioContext) {
                    return
                }

                const ctx = new AudioContext()
                const now = ctx.currentTime

                const playBell = (
                    freq: number,
                    startTime: number,
                    duration: number,
                    vol: number
                ) => {
                    const osc = ctx.createOscillator()
                    const gain = ctx.createGain()

                    // Combine sine and triangle for a bright, rich bell sound with body
                    osc.type = 'triangle'
                    osc.frequency.setValueAtTime(freq, startTime)

                    // Add subtle pitch vibration (vibrato) for a premium metallic chime feel
                    const lfo = ctx.createOscillator()
                    const lfoGain = ctx.createGain()
                    lfo.frequency.value = 8 // 8Hz vibration
                    lfoGain.gain.value = freq * 0.003 // pitch deviation depth
                    lfo.connect(lfoGain)
                    lfoGain.connect(osc.frequency)

                    gain.gain.setValueAtTime(0, startTime)
                    gain.gain.linearRampToValueAtTime(vol, startTime + 0.015) // snappy attack
                    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration) // long natural decay tail

                    osc.connect(gain)
                    gain.connect(ctx.destination)

                    lfo.start(startTime)
                    osc.start(startTime)

                    lfo.stop(startTime + duration)
                    osc.stop(startTime + duration)
                }

                // Play a gorgeous, rapid arpeggiated C-major 7 chord that builds excitement
                const baseVolume = 0.28
                playBell(261.63, now, 1.2, baseVolume * 0.8) // C4: Warm base note
                playBell(329.63, now + 0.055, 1.0, baseVolume * 0.9) // E4: Sweet harmony
                playBell(392.0, now + 0.11, 0.9, baseVolume) // G4: Bright tone
                playBell(523.25, now + 0.165, 0.8, baseVolume * 0.95) // C5: Soaring peak arpeggio
                playBell(783.99, now + 0.22, 0.7, baseVolume * 0.7) // G5: Dreamy upper harmonics
            } catch (err) {
                console.error('Failed to play generation notification sound:', err)
            }
        },
        [profile?.generationSound]
    )

    const setActiveGeneratedFilePath = React.useCallback((path: string | null) => {
        activeGeneratedFilePathRef.current = path
        setActiveGeneratedFilePathState(path)
    }, [])

    const updateAssistantMessage = React.useCallback(
        (messageId: string, updater: (message: Message) => Message) => {
            setMessages((prev) =>
                prev.map((message) => (message.id === messageId ? updater(message) : message))
            )
        },
        []
    )

    const setAssistantStatus = React.useCallback(
        (messageId: string, status: 'thinking' | 'building' | 'done' | 'error') => {
            updateAssistantMessage(messageId, (message) => ({
                ...message,
                status,
            }))
        },
        [updateAssistantMessage]
    )

    const appendAssistantChunk = React.useCallback(
        (messageId: string, chunk: string, streamMessageId?: string) => {
            updateAssistantMessage(messageId, (message) => {
                const isThinkingStream = streamMessageId?.endsWith(':thoughts')
                const isPlanStream = streamMessageId?.endsWith(':plan_of_action')
                const isSummaryStream = streamMessageId?.endsWith(':summary')

                let nextThoughts = message.thoughts ?? ''
                let nextPlan = message.plan ?? ''
                let nextSummary = message.summary ?? ''

                if (isThinkingStream) {
                    nextThoughts = `${nextThoughts}${chunk}`
                } else if (isPlanStream) {
                    nextPlan = `${nextPlan}${chunk}`
                } else if (isSummaryStream) {
                    nextSummary = `${nextSummary}${chunk}`
                }

                return {
                    ...message,
                    content: isSummaryStream ? message.content : `${message.content}${chunk}`,
                    thoughts: nextThoughts || undefined,
                    plan: nextPlan || undefined,
                    summary: nextSummary || undefined,
                }
            })
        },
        [updateAssistantMessage]
    )

    const setAssistantError = React.useCallback(
        (messageId: string, errorMessage: string) => {
            const userFacingMessage = getUserFacingGenerationError(errorMessage)

            updateAssistantMessage(messageId, (message) => ({
                ...message,
                status: 'error',
                content: message.content.trim()
                    ? `${message.content.trim()}\n\n${userFacingMessage}`
                    : userFacingMessage,
            }))
        },
        [updateAssistantMessage]
    )

    const setAssistantAppliedFiles = React.useCallback(
        (messageId: string, appliedFiles: string[]) => {
            updateAssistantMessage(messageId, (message) => ({
                ...message,
                appliedFiles,
            }))
        },
        [updateAssistantMessage]
    )

    const replaceGeneratedOutput = React.useCallback(
        (files: Record<string, string>, preferredPath?: string | null) => {
            const paths = Object.keys(files)
            const nextActivePath =
                preferredPath && paths.includes(preferredPath)
                    ? preferredPath
                    : (paths[paths.length - 1] ?? null)

            setGeneratedFiles(mapStoredFilesToGeneratedFiles(files))
            setActiveGeneratedFilePath(nextActivePath)
        },
        [setActiveGeneratedFilePath]
    )

    const resetGeneratedOutput = React.useCallback(() => {
        setGeneratedFiles({})
        setActiveGeneratedFilePath(null)
    }, [setActiveGeneratedFilePath])

    const resetGenerationRefs = React.useCallback(() => {
        activeAssistantMessageIdRef.current = null
        setGenerationPhase(null)
        setActiveOperation(null)
        setCurrentGenerationFilePaths([])
    }, [])

    const clearOpenedProject = React.useCallback(() => {
        setActiveProjectId(null)
        setActiveProjectName(null)
        setProjectVersions([])
        setActiveProjectVersionId(null)
        setProjectLoadError(null)
        setIsProjectOpening(false)
        setPreviewSession(null)
        setPreviewSessionError(null)
        setCanvasState(createEmptyCanvasDocument())
        lastAutoFixSignatureRef.current = null
    }, [])

    const abortGenerationRequest = React.useCallback(() => {
        generationAbortControllerRef.current?.abort()
        generationAbortControllerRef.current = null
    }, [])

    React.useEffect(() => {
        return () => {
            abortGenerationRequest()
        }
    }, [abortGenerationRequest])

    const requireAuthOr = (action: () => void) => {
        if (!isAuthenticated) {
            setShowAuthModal(true)
            return
        }

        action()
    }

    const startGeneratedFile = React.useCallback(
        (data: { path: string; purpose: string; generator: string }) => {
            setGeneratedFiles((prev) => ({
                ...prev,
                [data.path]: {
                    path: data.path,
                    content: prev[data.path]?.content ?? '',
                    status: 'building',
                    purpose: data.purpose,
                    generator: data.generator,
                },
            }))

            setActiveGeneratedFilePath(data.path)
        },
        [setActiveGeneratedFilePath]
    )

    const appendGeneratedFileChunk = React.useCallback((path: string, chunk: string) => {
        setGeneratedFiles((prev) => ({
            ...prev,
            [path]: {
                path,
                content: `${prev[path]?.content ?? ''}${chunk}`,
                status: 'building',
                purpose: prev[path]?.purpose,
                generator: prev[path]?.generator,
            },
        }))
    }, [])

    const completeGeneratedFile = React.useCallback((path: string) => {
        setGeneratedFiles((prev) => {
            const current = prev[path]

            if (!current) {
                return prev
            }

            return {
                ...prev,
                [path]: {
                    ...current,
                    status: 'done',
                },
            }
        })
    }, [])

    const markGeneratedFileError = React.useCallback((path: string) => {
        setGeneratedFiles((prev) => {
            const current = prev[path]

            if (!current) {
                return prev
            }

            return {
                ...prev,
                [path]: {
                    ...current,
                    status: 'error',
                },
            }
        })
    }, [])

    const hydrateProjectDetail = React.useCallback(
        (detail: BackendProjectDetail) => {
            setActiveProjectId(detail.project.id)
            setActiveProjectName(detail.project.name)
            setProjectVersions(detail.versions)
            setActiveProjectVersionId(detail.selectedVersionId)
            setProjectLoadError(null)

            const uiMessages = detail.chatMessages.map(mapBackendMessageToUIMessage)
            const activeVersionSummary = detail.activeVersion?.summary
            if (activeVersionSummary) {
                const lastAssistantIdx = [...uiMessages]
                    .reverse()
                    .findIndex((m) => m.role === 'assistant')
                if (lastAssistantIdx !== -1) {
                    const idx = uiMessages.length - 1 - lastAssistantIdx
                    uiMessages[idx].summary = activeVersionSummary
                }
            }
            setMessages(uiMessages)

            let resolvedType: 'generated' | 'github' | 'zip' = 'generated'
            const firstMsg = uiMessages[0]
            if (firstMsg && firstMsg.role === 'user') {
                const content = firstMsg.content
                if (
                    content.startsWith('Importing GitHub repository') ||
                    content === 'Imported project files'
                ) {
                    resolvedType = 'github'
                } else if (content.startsWith('Uploading ZIP archive')) {
                    resolvedType = 'zip'
                }
            }

            // Fallback to project prompt/description if messages are empty (e.g. during initial placeholder load)
            if (resolvedType === 'generated') {
                const projectPrompt = detail.project.prompt?.toLowerCase() || ''
                if (
                    projectPrompt.includes('imported from') ||
                    projectPrompt.startsWith('importing github repository')
                ) {
                    resolvedType = 'github'
                } else if (
                    projectPrompt.startsWith('uploading zip archive') ||
                    projectPrompt.includes('project.zip')
                ) {
                    resolvedType = 'zip'
                }
            }

            setProjectType(resolvedType)

            setCanvasState(detail.canvasState ?? createEmptyCanvasDocument())
            lastSavedCanvasRef.current = JSON.stringify(
                detail.canvasState ?? createEmptyCanvasDocument()
            )
            replaceGeneratedOutput(detail.generatedFiles)
            setGenerationPhase(null)
            setActiveOperation(null)
            lastAutoFixSignatureRef.current = null
            navigate(`/project/${toProjectSlug(detail.project.name)}`, { replace: true })
        },
        [navigate, replaceGeneratedOutput]
    )

    const hydrateAppliedProjectChange = React.useCallback(
        (result: AppliedProjectChangeResult) => {
            const preferredPath =
                result.appliedFiles[result.appliedFiles.length - 1] ??
                activeGeneratedFilePathRef.current

            setActiveProjectId(result.project.id)
            setActiveProjectName(result.project.name)
            setProjectVersions(result.versions)
            setActiveProjectVersionId(result.version.id)
            setProjectLoadError(null)

            const uiMessages = result.chatMessages.map(mapBackendMessageToUIMessage)
            const activeVersionSummary = result.versions.find(
                (v) => v.id === result.version.id
            )?.summary
            if (activeVersionSummary) {
                const lastAssistantIdx = [...uiMessages]
                    .reverse()
                    .findIndex((m) => m.role === 'assistant')
                if (lastAssistantIdx !== -1) {
                    const idx = uiMessages.length - 1 - lastAssistantIdx
                    uiMessages[idx].summary = activeVersionSummary
                }
            }
            setMessages(uiMessages)

            replaceGeneratedOutput(result.generatedFiles, preferredPath)
            setGenerationPhase('done')
            lastSavedCanvasRef.current = JSON.stringify(canvasState)
        },
        [replaceGeneratedOutput]
    )

    const openProject = React.useCallback(
        async ({
            projectId,
            versionId,
            originView,
            abortActiveGeneration = true,
        }: {
            projectId: string
            versionId?: string | null
            originView?: ViewState
            abortActiveGeneration?: boolean
        }) => {
            if (abortActiveGeneration) {
                abortGenerationRequest()
                setIsGenerating(false)
                resetGenerationRefs()
            }

            if (originView) {
                outputOriginViewRef.current = originView
            }

            setIsMobileSidebarOpen(false)
            setIsProjectOpening(true)
            setProjectLoadError(null)

            try {
                const detail = await projectAPI.getProject(projectId, versionId)
                hydrateProjectDetail(detail)
            } catch (error) {
                setProjectLoadError(
                    error instanceof Error ? error.message : 'Failed to open project'
                )
            } finally {
                setIsProjectOpening(false)
            }
        },
        [abortGenerationRequest, hydrateProjectDetail, resetGenerationRefs]
    )

    // Deep-link resolution for /project/:slug on mount / project list load
    React.useEffect(() => {
        if (!isAuthenticated || projects.length === 0 || activeProjectId || isProjectOpening) {
            return
        }

        if (location.pathname.startsWith('/project/')) {
            const parts = location.pathname.split('/')
            const slug = parts[parts.length - 1]
            if (slug && slug !== 'untitled') {
                const matchingProject = projects.find(
                    (p) => p.id === slug || toProjectSlug(p.title) === slug
                )
                if (matchingProject) {
                    void openProject({
                        projectId: matchingProject.id,
                        originView: 'all-projects',
                    })
                }
            }
        }
    }, [
        isAuthenticated,
        projects,
        activeProjectId,
        isProjectOpening,
        location.pathname,
        openProject,
    ])

    // Sync selected model to localStorage
    React.useEffect(() => {
        if (selectedModel) {
            localStorage.setItem('december_selected_model', selectedModel)
        } else {
            localStorage.removeItem('december_selected_model')
        }
    }, [selectedModel])

    // Auto-save canvas state to backend
    React.useEffect(() => {
        if (!isAuthenticated || !activeProjectId) {
            return
        }

        const serialized = JSON.stringify(canvasState)
        if (serialized === lastSavedCanvasRef.current) {
            return
        }

        // Skip auto-saving if it is the default empty canvas document and user hasn't interacted
        if (canvasState.items.length === 0 && !canvasState.hasInteracted) {
            return
        }

        const timer = setTimeout(async () => {
            try {
                lastSavedCanvasRef.current = serialized
                await canvasAPI.saveCanvas({
                    projectId: activeProjectId,
                    versionId: activeProjectVersionId,
                    canvasState,
                })
                console.log('[canvas] auto-saved successfully')
            } catch (err) {
                console.error('[canvas] failed to auto-save:', err)
            }
        }, 1500)

        return () => clearTimeout(timer)
    }, [canvasState, activeProjectId, activeProjectVersionId, isAuthenticated])

    const beginImportOutput = React.useCallback(
        (message: string) => {
            const assistantMessageId = `${Date.now()}-import-assistant`

            outputOriginViewRef.current = view
            setMessages([
                {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: message,
                    type: 'text',
                    status: 'building',
                },
            ])
            resetGeneratedOutput()
            setGenerationPhase(null)
            setActiveOperation('build')
            setCurrentGenerationFilePaths([])
            setIsGenerating(true)
            setProjectLoadError(null)
        },
        [resetGeneratedOutput, view]
    )

    const pollImportUntilComplete = React.useCallback(
        async (
            importId: string,
            onStatus?: (status: ProjectImportStatus) => Promise<void> | void
        ) => {
            const startedAt = Date.now()
            const timeoutMs = 3 * 60 * 1000

            while (Date.now() - startedAt < timeoutMs) {
                const status = await importsAPI.getImportStatus(importId)

                setImportState({
                    status: status.status === 'FAILED' ? 'failed' : 'loading',
                    message: getImportStatusMessage(status),
                })

                await onStatus?.(status)

                if (status.status === 'READY') {
                    return status
                }

                if (status.status === 'FAILED') {
                    throw new Error(status.errorMessage || 'Import failed')
                }

                await new Promise((resolve) => window.setTimeout(resolve, 1500))
            }

            throw new Error('Import timed out while preparing the preview')
        },
        []
    )

    const handleImportGithub = React.useCallback(
        async (repoUrl: string) => {
            await requireAuthOr(async () => {
                setMessages([])
                resetGeneratedOutput()
                setGenerationPhase(null)
                setActiveOperation('build')
                setIsGenerating(true)
                setProjectType('github')
                setProjectLoadError(null)
                setImportState({ status: 'loading', message: 'Validating GitHub repository' })
                let hasLoadedFinalFiles = false

                try {
                    const queuedImport = await importsAPI.importGithub(repoUrl)

                    if (queuedImport.projectId) {
                        sessionStorage.setItem(
                            `december_actively_importing_${queuedImport.projectId}`,
                            'true'
                        )
                        void queryClient.invalidateQueries({ queryKey: ['projects'] })
                        await openProject({
                            projectId: queuedImport.projectId,
                            versionId: queuedImport.projectVersionId,
                            originView: view,
                            abortActiveGeneration: false,
                        })
                    }

                    const completedImport = await pollImportUntilComplete(
                        queuedImport.id,
                        async (status) => {
                            if (!status.projectId) {
                                return
                            }

                            if (
                                !hasLoadedFinalFiles &&
                                (status.status === 'STARTING_RUNTIME' || status.status === 'READY')
                            ) {
                                hasLoadedFinalFiles = true
                                void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                await openProject({
                                    projectId: status.projectId,
                                    versionId: status.projectVersionId,
                                    originView: view,
                                    abortActiveGeneration: false,
                                })
                            }
                        }
                    )

                    if (!completedImport.projectId) {
                        throw new Error('Import completed without a project')
                    }

                    setImportState({ status: 'ready', message: 'Opening imported project' })
                    queryClient.invalidateQueries({ queryKey: ['projects'] })
                    await openProject({
                        projectId: completedImport.projectId,
                        versionId: completedImport.projectVersionId,
                        originView: view,
                        abortActiveGeneration: false,
                    })
                } catch (error) {
                    setImportState({
                        status: 'failed',
                        message: error instanceof Error ? error.message : 'Import failed',
                    })
                } finally {
                    resetGenerationRefs()
                    setIsGenerating(false)
                }
            })
        },
        [
            openProject,
            pollImportUntilComplete,
            queryClient,
            requireAuthOr,
            resetGenerationRefs,
            view,
        ]
    )

    const handleImportZip = React.useCallback(
        async (file: File) => {
            await requireAuthOr(async () => {
                setMessages([])
                resetGeneratedOutput()
                setGenerationPhase(null)
                setActiveOperation('build')
                setIsGenerating(true)
                setProjectType('zip')
                setProjectLoadError(null)
                setImportState({ status: 'loading', message: 'Uploading zip archive' })
                let hasLoadedFinalFiles = false

                try {
                    const queuedImport = await importsAPI.importZip(file)

                    if (queuedImport.projectId) {
                        sessionStorage.setItem(
                            `december_actively_importing_${queuedImport.projectId}`,
                            'true'
                        )
                        void queryClient.invalidateQueries({ queryKey: ['projects'] })
                        await openProject({
                            projectId: queuedImport.projectId,
                            versionId: queuedImport.projectVersionId,
                            originView: view,
                            abortActiveGeneration: false,
                        })
                    }

                    const completedImport = await pollImportUntilComplete(
                        queuedImport.id,
                        async (status) => {
                            if (!status.projectId) {
                                return
                            }

                            if (
                                !hasLoadedFinalFiles &&
                                (status.status === 'STARTING_RUNTIME' || status.status === 'READY')
                            ) {
                                hasLoadedFinalFiles = true
                                void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                await openProject({
                                    projectId: status.projectId,
                                    versionId: status.projectVersionId,
                                    originView: view,
                                    abortActiveGeneration: false,
                                })
                            }
                        }
                    )

                    if (!completedImport.projectId) {
                        throw new Error('Import completed without a project')
                    }

                    setImportState({ status: 'ready', message: 'Opening imported project' })
                    queryClient.invalidateQueries({ queryKey: ['projects'] })
                    await openProject({
                        projectId: completedImport.projectId,
                        versionId: completedImport.projectVersionId,
                        originView: view,
                        abortActiveGeneration: false,
                    })
                } catch (error) {
                    setImportState({
                        status: 'failed',
                        message: error instanceof Error ? error.message : 'Import failed',
                    })
                } finally {
                    resetGenerationRefs()
                    setIsGenerating(false)
                }
            })
        },
        [
            openProject,
            pollImportUntilComplete,
            queryClient,
            requireAuthOr,
            resetGenerationRefs,
            view,
        ]
    )

    const resetGenerationFlow = React.useCallback(() => {
        abortGenerationRequest()
        resetGenerationRefs()
        resetGeneratedOutput()
        setIsGenerating(false)
    }, [abortGenerationRequest, resetGeneratedOutput, resetGenerationRefs])

    const handleResetImportState = React.useCallback(() => {
        setImportState({ status: 'idle', message: null })
    }, [])

    React.useEffect(() => {
        if (!isAuthenticated || !activeProjectId || !activeProjectVersionId) {
            setPreviewSession(null)
            setPreviewSessionError(null)
            return
        }

        let isCancelled = false
        let timeoutHandle: number | null = null

        const schedulePoll = (delay: number) => {
            timeoutHandle = window.setTimeout(() => {
                void pollStatus()
            }, delay)
        }

        const pollStatus = async () => {
            try {
                const nextStatus = await previewAPI.getPreviewStatus(activeProjectId)

                if (isCancelled) {
                    return
                }

                setPreviewSession(nextStatus)
                setPreviewSessionError(null)
                schedulePoll(nextStatus.backendStatus === 'ready' && !isGenerating ? 4000 : 1500)
            } catch (error) {
                if (isCancelled) {
                    return
                }

                setPreviewSessionError(
                    error instanceof Error ? error.message : 'Failed to refresh preview'
                )
                schedulePoll(3000)
            }
        }

        void (async () => {
            try {
                const nextStatus = await previewAPI.startPreview(
                    activeProjectId,
                    activeProjectVersionId
                )

                if (isCancelled) {
                    return
                }

                setPreviewSession(nextStatus)
                setPreviewSessionError(null)
            } catch (error) {
                if (isCancelled) {
                    return
                }

                setPreviewSessionError(
                    error instanceof Error ? error.message : 'Failed to start preview'
                )
            }

            if (!isCancelled) {
                schedulePoll(1000)
            }
        })()

        return () => {
            isCancelled = true

            if (timeoutHandle !== null) {
                window.clearTimeout(timeoutHandle)
            }
        }
    }, [activeProjectId, activeProjectVersionId, isAuthenticated, isGenerating])

    const startGeneration = React.useCallback(
        (
            prompt: string,
            assistantMessageId: string,
            projectId?: string | null,
            nextCanvasState?: CanvasDocument
        ) => {
            abortGenerationRequest()
            resetGeneratedOutput()
            activeAssistantMessageIdRef.current = assistantMessageId
            setGenerationPhase('thinking')
            setActiveOperation('build')
            setCurrentGenerationFilePaths([])
            setIsGenerating(true)
            setProjectType('generated')
            setProjectLoadError(null)

            const abortController = new AbortController()
            generationAbortControllerRef.current = abortController

            void (async () => {
                try {
                    await generationAPI.generateProjectStream({
                        prompt,
                        projectId,
                        canvasState: nextCanvasState,
                        model: selectedModel || undefined,
                        signal: abortController.signal,
                        onEvent: (event) => {
                            const activeMessageId = activeAssistantMessageIdRef.current

                            if (!activeMessageId) {
                                return
                            }

                            switch (event.type) {
                                case 'connected':
                                    return
                                case 'project-created':
                                    setActiveProjectId(event.data.project.id)
                                    setActiveProjectName(event.data.project.name)
                                    setActiveProjectVersionId(event.data.version.id)
                                    navigate(`/project/${toProjectSlug(event.data.project.name)}`, {
                                        replace: true,
                                    })
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    return
                                case 'phase':
                                    if (event.data.phase === 'building') {
                                        setGenerationPhase('building')
                                        setAssistantStatus(activeMessageId, 'building')
                                    }

                                    return
                                case 'message-start':
                                    if (event.data.status === 'thinking') {
                                        setGenerationPhase('thinking')
                                        setAssistantStatus(activeMessageId, 'thinking')
                                    }

                                    return
                                case 'message-chunk':
                                    appendAssistantChunk(
                                        activeMessageId,
                                        event.data.chunk,
                                        event.data.messageId
                                    )
                                    return
                                case 'message-complete':
                                    return
                                case 'build-plan':
                                case 'patch-plan':
                                    return
                                case 'file-start':
                                    setCurrentGenerationFilePaths((prev) =>
                                        prev.includes(event.data.path)
                                            ? prev
                                            : [...prev, event.data.path]
                                    )
                                    startGeneratedFile(event.data)
                                    return
                                case 'file-chunk':
                                    appendGeneratedFileChunk(event.data.path, event.data.chunk)
                                    return
                                case 'file-complete':
                                    completeGeneratedFile(event.data.path)
                                    return
                                case 'file-error':
                                    markGeneratedFileError(event.data.path)
                                    return
                                case 'result':
                                    setGenerationPhase('done')
                                    setAssistantStatus(activeMessageId, 'done')
                                    replaceGeneratedOutput(event.data.generatedFiles)
                                    setActiveProjectId(event.data.project.id)
                                    setActiveProjectName(event.data.project.name)
                                    setActiveProjectVersionId(event.data.version.id)
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    void openProject({
                                        projectId: event.data.project.id,
                                        versionId: event.data.version.id,
                                        originView: outputOriginViewRef.current,
                                        abortActiveGeneration: false,
                                    })
                                    playNotificationSound('first')
                                    return
                                case 'error':
                                    if (activeGeneratedFilePathRef.current) {
                                        markGeneratedFileError(activeGeneratedFilePathRef.current)
                                    }
                                    return
                            }
                        },
                    })
                } catch (error) {
                    if (abortController.signal.aborted) {
                        return
                    }

                    const activeMessageId = activeAssistantMessageIdRef.current
                    const message =
                        error instanceof Error ? error.message : 'Generation failed unexpectedly.'

                    if (activeGeneratedFilePathRef.current) {
                        markGeneratedFileError(activeGeneratedFilePathRef.current)
                    }

                    if (activeMessageId) {
                        setAssistantError(activeMessageId, message)
                    }
                } finally {
                    if (generationAbortControllerRef.current === abortController) {
                        generationAbortControllerRef.current = null
                        resetGenerationRefs()
                        setIsGenerating(false)
                    }
                }
            })()
        },
        [
            abortGenerationRequest,
            appendAssistantChunk,
            appendGeneratedFileChunk,
            completeGeneratedFile,
            markGeneratedFileError,
            openProject,
            queryClient,
            replaceGeneratedOutput,
            resetGeneratedOutput,
            resetGenerationRefs,
            setAssistantError,
            setAssistantStatus,
            startGeneratedFile,
        ]
    )

    const handlePromptSubmit = React.useCallback(
        (prompt: string) => {
            requireAuthOr(() => {
                const normalizedPrompt = prompt.trim()
                if (!normalizedPrompt) {
                    return
                }

                outputOriginViewRef.current = view
                setProjectLoadError(null)

                const baseId = Date.now().toString()
                const assistantMessageId = `${baseId}-assistant`
                const userMsg: Message = {
                    id: baseId,
                    role: 'user',
                    content: normalizedPrompt,
                }
                const assistantMsg: Message = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: '',
                    type: 'text',
                    status: 'thinking',
                }

                setMessages([userMsg, assistantMsg])
                startGeneration(normalizedPrompt, assistantMessageId, activeProjectId, canvasState)
            })
        },
        [activeProjectId, canvasState, startGeneration, view, isAuthenticated]
    )

    const applyProjectChange = React.useCallback(
        ({
            kind,
            prompt,
            selectedElement,
            errorMessage,
            stack,
            visibleUserMessage,
        }: {
            kind: 'edit' | 'fix'
            prompt?: string
            selectedElement?: PreviewSelectedElement
            errorMessage?: string
            stack?: string | null
            visibleUserMessage: string
            canvasState?: CanvasDocument
        }) => {
            if (!activeProjectId) {
                return
            }

            abortGenerationRequest()
            setProjectLoadError(null)

            const baseId = Date.now().toString()
            const assistantMessageId = `${baseId}-assistant`
            const userMsg: Message = {
                id: baseId,
                role: 'user',
                content: visibleUserMessage,
            }
            const assistantMsg: Message = {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                type: 'text',
                status: 'thinking',
            }

            setMessages((prev) => [...prev, userMsg, assistantMsg])
            activeAssistantMessageIdRef.current = assistantMessageId
            setGenerationPhase('thinking')
            setActiveOperation(kind)
            setCurrentGenerationFilePaths([])
            setIsGenerating(true)
            setProjectType('generated')

            const abortController = new AbortController()
            generationAbortControllerRef.current = abortController

            void (async () => {
                try {
                    let didHydrateStreamResult = false
                    const handleStreamEvent = (event: GenerationStreamEvent) => {
                        const activeMessageId = activeAssistantMessageIdRef.current

                        if (!activeMessageId) {
                            return
                        }

                        switch (event.type) {
                            case 'connected':
                                return
                            case 'phase':
                                if (event.data.phase === 'thinking') {
                                    setGenerationPhase('thinking')
                                    setAssistantStatus(activeMessageId, 'thinking')
                                }

                                if (event.data.phase === 'building') {
                                    setGenerationPhase('building')
                                    setAssistantStatus(activeMessageId, 'building')
                                }

                                return
                            case 'message-start':
                                if (event.data.status === 'thinking') {
                                    setGenerationPhase('thinking')
                                    setAssistantStatus(activeMessageId, 'thinking')
                                }

                                return
                            case 'message-chunk':
                                appendAssistantChunk(
                                    activeMessageId,
                                    event.data.chunk,
                                    event.data.messageId
                                )
                                return
                            case 'message-complete':
                                return
                            case 'patch-plan':
                                setAssistantAppliedFiles(
                                    activeMessageId,
                                    event.data.files.map((f) => f.path)
                                )
                                return
                            case 'build-plan':
                                setAssistantAppliedFiles(
                                    activeMessageId,
                                    event.data.files.map((f) => f.path)
                                )
                                return
                            case 'file-start':
                                setCurrentGenerationFilePaths((prev) =>
                                    prev.includes(event.data.path)
                                        ? prev
                                        : [...prev, event.data.path]
                                )
                                startGeneratedFile(event.data)
                                return
                            case 'file-chunk':
                                appendGeneratedFileChunk(event.data.path, event.data.chunk)
                                return
                            case 'file-complete':
                                completeGeneratedFile(event.data.path)
                                return
                            case 'file-error':
                                markGeneratedFileError(event.data.path)
                                return
                            case 'result':
                                if (
                                    event.data.versions &&
                                    event.data.chatMessages &&
                                    event.data.appliedFiles &&
                                    event.data.deletedFiles &&
                                    event.data.assistantMessage
                                ) {
                                    didHydrateStreamResult = true
                                    hydrateAppliedProjectChange({
                                        project: event.data.project,
                                        version: event.data.version,
                                        versions: event.data.versions,
                                        chatMessages: event.data.chatMessages,
                                        generatedFiles: event.data.generatedFiles,
                                        appliedFiles: event.data.appliedFiles,
                                        deletedFiles: event.data.deletedFiles,
                                        assistantMessage: event.data.assistantMessage,
                                    })
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    playNotificationSound('followup')
                                }
                                return
                            case 'project-created':
                            case 'error':
                                return
                        }
                    }

                    const result =
                        kind === 'edit'
                            ? await generationAPI.applyProjectEdit({
                                  projectId: activeProjectId,
                                  versionId: activeProjectVersionId,
                                  prompt: prompt ?? '',
                                  ...(selectedElement ? { selectedElement } : {}),
                                  ...(canvasState ? { canvasState } : {}),
                                  model: selectedModel || undefined,
                                  signal: abortController.signal,
                                  onEvent: handleStreamEvent,
                              })
                            : await generationAPI.applyProjectFix({
                                  projectId: activeProjectId,
                                  versionId: activeProjectVersionId,
                                  errorMessage: errorMessage ?? '',
                                  ...(stack ? { stack } : {}),
                                  model: selectedModel || undefined,
                                  signal: abortController.signal,
                                  onEvent: handleStreamEvent,
                              })

                    if (abortController.signal.aborted) {
                        return
                    }

                    if (result && !didHydrateStreamResult) {
                        hydrateAppliedProjectChange(result)
                        void queryClient.invalidateQueries({ queryKey: ['projects'] })
                        playNotificationSound('followup')
                    }
                } catch (error) {
                    if (abortController.signal.aborted) {
                        return
                    }

                    const activeMessageId = activeAssistantMessageIdRef.current
                    const message =
                        error instanceof Error
                            ? error.message
                            : 'Project update failed unexpectedly.'

                    if (activeMessageId) {
                        setAssistantError(activeMessageId, message)
                    }
                } finally {
                    if (generationAbortControllerRef.current === abortController) {
                        generationAbortControllerRef.current = null
                        resetGenerationRefs()
                        setIsGenerating(false)
                    }
                }
            })()
        },
        [
            activeProjectId,
            activeProjectVersionId,
            abortGenerationRequest,
            appendAssistantChunk,
            appendGeneratedFileChunk,
            completeGeneratedFile,
            hydrateAppliedProjectChange,
            markGeneratedFileError,
            queryClient,
            resetGenerationRefs,
            setAssistantError,
            setAssistantAppliedFiles,
            setAssistantStatus,
            startGeneratedFile,
        ]
    )

    const handleOutputPromptSubmit = React.useCallback(
        (prompt: string, selectedElement?: PreviewSelectedElement) => {
            requireAuthOr(() => {
                const normalizedPrompt = prompt.trim()

                if (!normalizedPrompt) {
                    return
                }

                if (!activeProjectId) {
                    handlePromptSubmit(normalizedPrompt)
                    return
                }

                outputOriginViewRef.current = view
                applyProjectChange({
                    kind: 'edit',
                    prompt: normalizedPrompt,
                    selectedElement,
                    visibleUserMessage: normalizedPrompt,
                    canvasState,
                })
            })
        },
        [
            activeProjectId,
            applyProjectChange,
            canvasState,
            handlePromptSubmit,
            view,
            isAuthenticated,
        ]
    )

    const handlePreviewRuntimeError = React.useCallback(
        (runtimeError: PreviewRuntimeError) => {
            requireAuthOr(() => {
                if (!activeProjectId || isGenerating) {
                    return
                }

                const message = runtimeError.message.trim()

                if (!message) {
                    return
                }

                const signature = `${activeProjectVersionId ?? 'current'}:${message}`

                if (lastAutoFixSignatureRef.current === signature) {
                    return
                }

                lastAutoFixSignatureRef.current = signature
                outputOriginViewRef.current = view
                applyProjectChange({
                    kind: 'fix',
                    errorMessage: message,
                    stack: runtimeError.stack,
                    visibleUserMessage: `Fix preview error: ${message}`,
                })
            })
        },
        [
            activeProjectId,
            activeProjectVersionId,
            applyProjectChange,
            isGenerating,
            view,
            isAuthenticated,
        ]
    )

    const handleOpenProject = React.useCallback(
        (projectId: string, versionId?: string | null) => {
            requireAuthOr(() => {
                void openProject({
                    projectId,
                    versionId,
                    originView: view,
                })
            })
        },
        [openProject, view, isAuthenticated]
    )

    const handleSelectVersion = React.useCallback(
        (versionId: string) => {
            if (
                !activeProjectId ||
                !versionId ||
                versionId === activeProjectVersionId ||
                isGenerating
            ) {
                return
            }

            void openProject({
                projectId: activeProjectId,
                versionId,
                originView: outputOriginViewRef.current,
            })
        },
        [activeProjectId, activeProjectVersionId, isGenerating, openProject]
    )

    const handleDownloadProject = React.useCallback(async () => {
        if (!activeProjectId) {
            return
        }

        try {
            const result = await projectAPI.downloadProject(activeProjectId)
            const url = window.URL.createObjectURL(result.blob)
            const anchor = document.createElement('a')
            anchor.href = url
            const username = (profile?.username || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '')
            const projectName = (activeProjectName || 'project')
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9_-]/g, '')
            anchor.download = `december-${username}-${projectName}.zip`
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            setProjectLoadError(
                error instanceof Error ? error.message : 'Failed to download project'
            )
        }
    }, [activeProjectId, profile?.username, activeProjectName])

    const handleNewThread = () => {
        outputOriginViewRef.current = 'chat'
        if (activeProjectId) {
            void previewAPI.stopPreview(activeProjectId).catch((err) => {
                console.error('Failed to stop preview:', err)
            })
        }
        setMessages([])
        clearOpenedProject()
        resetGenerationFlow()
        setImportState({ status: 'idle', message: null })
        window.location.href = '/'
    }

    const handleHomeClick = React.useCallback(() => {
        outputOriginViewRef.current = 'chat'
        if (activeProjectId) {
            void previewAPI.stopPreview(activeProjectId).catch((err) => {
                console.error('Failed to stop preview:', err)
            })
        }
        setMessages([])
        clearOpenedProject()
        resetGenerationFlow()
        setImportState({ status: 'idle', message: null })
        navigate('/')
    }, [activeProjectId, clearOpenedProject, resetGenerationFlow, navigate])

    const handleNavigate = (target: ViewState) => {
        if (target === 'docs') {
            navigate(getPathForView(target))
            return
        }
        requireAuthOr(() => {
            navigate(getPathForView(target))
        })
    }

    const handleSignOut = () => {
        abortGenerationRequest()
        void profileAPI.signout().catch(() => {
            // Local cleanup should still happen if the server session is already invalid.
        })
        setIsAuthenticated(false)
        queryClient.removeQueries({ queryKey: ['projects'] })
        queryClient.removeQueries({ queryKey: ['profile'] })
        outputOriginViewRef.current = 'chat'
        navigate('/')
        setMessages([])
        clearOpenedProject()
        resetGenerationFlow()
        setImportState({ status: 'idle', message: null })
    }

    const isHome = view === 'chat' && messages.length === 0 && !isProjectOpening
    const showSidebar =
        !(!isHome && (view === 'chat' || view === 'project')) &&
        view !== 'profile' &&
        view !== 'docs' &&
        view !== 'cli'
    const isProjectsInitialLoading = isProjectsLoading && projects.length === 0
    const projectsErrorMessage = projectsError instanceof Error ? projectsError.message : null

    const handleBackFromOutput = () => {
        if (activeProjectId) {
            void previewAPI.stopPreview(activeProjectId).catch((err) => {
                console.error('Failed to stop preview:', err)
            })
        }
        window.location.href = '/'
    }

    return {
        queryClient,
        view,
        messages,
        generatedFiles,
        activeFilesToDisplay,
        activeGeneratedFilePath,
        generationPhase,
        activeOperation,
        isGenerating,
        setIsAuthenticated,
        showAuthModal,
        setShowAuthModal,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        isAuthenticated,
        projects,
        isProjectsInitialLoading,
        isProjectsFetching,
        projectsErrorMessage,
        isHome,
        showSidebar,
        activeProjectId,
        activeProjectName,
        canvasState,
        setCanvasState,
        selectedModel,
        setSelectedModel,
        projectVersions,
        activeProjectVersionId,
        isProjectOpening,
        projectLoadError,
        previewSession,
        previewSessionError,
        importState,
        projectType,
        handleNewThread,
        handleHomeClick,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleOutputPromptSubmit,
        handlePreviewRuntimeError,
        handleImportGithub,
        handleImportZip,
        handleBackFromOutput,
        handleOpenProject,
        handleSelectVersion,
        handleDownloadProject,
        handleOpenFile: setActiveGeneratedFilePath,
        resetImportState: handleResetImportState,
    }
}
