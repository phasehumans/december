import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Message } from '@/features/chat/types'
import type { ViewState } from '@/app/types'
import { clearAuthToken, getAuthToken } from '@/shared/api/client'
import {
    generationAPI,
    type AppliedProjectChangeResult,
} from '@/features/generation/api/generation'
import {
    projectAPI,
    type BackendProjectDetail,
    type BackendProjectMessage,
    type BackendProjectVersionSummary,
} from '@/features/projects/api/project'
import { mapBackendProjectToUIProject } from '@/app/mapProject'
import { createEmptyCanvasDocument, type CanvasDocument } from '@/features/canvas/types'
import { previewAPI } from '@/features/preview/api'
import type {
    GeneratedProjectFile,
    OutputOperation,
    PreviewRuntimeError,
    PreviewSelectedElement,
    PreviewSessionStatus,
} from '@/features/preview/types'

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

const mapBackendMessageToUIMessage = (message: BackendProjectMessage): Message => ({
    id: message.id,
    role: message.role === 'USER' ? 'user' : message.role === 'SYSTEM' ? 'system' : 'assistant',
    content: message.content,
    type: 'text',
    status: message.status ?? 'done',
})

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

export const useAppController = () => {
    const queryClient = useQueryClient()

    const [view, setView] = React.useState<ViewState>('chat')
    const [messages, setMessages] = React.useState<Message[]>([])
    const [generatedFiles, setGeneratedFiles] = React.useState<
        Record<string, GeneratedProjectFile>
    >({})
    const [activeGeneratedFilePath, setActiveGeneratedFilePathState] = React.useState<
        string | null
    >(null)
    const [generationPhase, setGenerationPhase] = React.useState<
        'thinking' | 'planning' | 'building' | 'done' | null
    >(null)
    const [activeOperation, setActiveOperation] = React.useState<OutputOperation | null>(null)
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [authToken, setAuthTokenState] = React.useState<string | null>(() => getAuthToken())
    const [showAuthModal, setShowAuthModal] = React.useState(false)
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false)
    const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null)
    const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null)
    const [canvasState, setCanvasState] = React.useState<CanvasDocument>(() =>
        createEmptyCanvasDocument()
    )
    const [projectVersions, setProjectVersions] = React.useState<BackendProjectVersionSummary[]>([])
    const [activeProjectVersionId, setActiveProjectVersionId] = React.useState<string | null>(null)
    const [isProjectOpening, setIsProjectOpening] = React.useState(false)
    const [projectLoadError, setProjectLoadError] = React.useState<string | null>(null)
    const [previewSession, setPreviewSession] = React.useState<PreviewSessionStatus | null>(null)
    const [previewSessionError, setPreviewSessionError] = React.useState<string | null>(null)
    const generationAbortControllerRef = React.useRef<AbortController | null>(null)
    const activeAssistantMessageIdRef = React.useRef<string | null>(null)
    const activeGeneratedFilePathRef = React.useRef<string | null>(null)
    const outputOriginViewRef = React.useRef<ViewState>('chat')
    const lastAutoFixSignatureRef = React.useRef<string | null>(null)

    const isAuthenticated = Boolean(authToken)

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
                    const updatedAtDiff =
                        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

                    if (updatedAtDiff !== 0) {
                        return updatedAtDiff
                    }

                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
                })
                .map(mapBackendProjectToUIProject),
    })

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
        (messageId: string, status: 'thinking' | 'planning' | 'building' | 'done' | 'error') => {
            updateAssistantMessage(messageId, (message) => ({
                ...message,
                status,
            }))
        },
        [updateAssistantMessage]
    )

    const appendAssistantChunk = React.useCallback(
        (messageId: string, chunk: string) => {
            updateAssistantMessage(messageId, (message) => ({
                ...message,
                content: `${message.content}${chunk}`,
            }))
        },
        [updateAssistantMessage]
    )

    const ensureAssistantSpacing = React.useCallback(
        (messageId: string) => {
            updateAssistantMessage(messageId, (message) => {
                if (!message.content.trim()) {
                    return message
                }

                if (message.content.endsWith('\n\n')) {
                    return message
                }

                const spacer = message.content.endsWith('\n') ? '\n' : '\n\n'

                return {
                    ...message,
                    content: `${message.content}${spacer}`,
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
            setMessages(detail.chatMessages.map(mapBackendMessageToUIMessage))
            setCanvasState(detail.canvasState ?? createEmptyCanvasDocument())
            replaceGeneratedOutput(detail.generatedFiles)
            setGenerationPhase(null)
            setActiveOperation(null)
            lastAutoFixSignatureRef.current = null
        },
        [replaceGeneratedOutput]
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
            setMessages(result.chatMessages.map(mapBackendMessageToUIMessage))
            replaceGeneratedOutput(result.generatedFiles, preferredPath)
            setGenerationPhase('done')
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
            setView('chat')

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

    const resetGenerationFlow = React.useCallback(() => {
        abortGenerationRequest()
        resetGenerationRefs()
        resetGeneratedOutput()
        setIsGenerating(false)
    }, [abortGenerationRequest, resetGeneratedOutput, resetGenerationRefs])

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
            setIsGenerating(true)
            setProjectLoadError(null)

            const abortController = new AbortController()
            generationAbortControllerRef.current = abortController

            void (async () => {
                try {
                    await generationAPI.generateProjectStream({
                        prompt,
                        projectId,
                        canvasState: nextCanvasState,
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
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    return
                                case 'phase':
                                    if (event.data.phase === 'planning') {
                                        setGenerationPhase('planning')
                                        setAssistantStatus(activeMessageId, 'planning')
                                        ensureAssistantSpacing(activeMessageId)
                                    }

                                    if (event.data.phase === 'building') {
                                        setGenerationPhase('building')
                                        setAssistantStatus(activeMessageId, 'building')
                                    }

                                    if (event.data.phase === 'done') {
                                        setGenerationPhase('done')
                                        setAssistantStatus(activeMessageId, 'done')
                                    }

                                    return
                                case 'message-start':
                                    if (event.data.status === 'thinking') {
                                        setGenerationPhase('thinking')
                                        setAssistantStatus(activeMessageId, 'thinking')
                                    }

                                    if (event.data.status === 'planning') {
                                        setGenerationPhase('planning')
                                        setAssistantStatus(activeMessageId, 'planning')
                                        ensureAssistantSpacing(activeMessageId)
                                    }

                                    return
                                case 'message-chunk':
                                    appendAssistantChunk(activeMessageId, event.data.chunk)
                                    return
                                case 'message-complete':
                                    return
                                case 'build-plan':
                                    return
                                case 'file-start':
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
            ensureAssistantSpacing,
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
                setView('chat')
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
            setIsGenerating(true)

            const abortController = new AbortController()
            generationAbortControllerRef.current = abortController

            void (async () => {
                try {
                    const result =
                        kind === 'edit'
                            ? await generationAPI.applyProjectEdit({
                                  projectId: activeProjectId,
                                  versionId: activeProjectVersionId,
                                  prompt: prompt ?? '',
                                  ...(selectedElement ? { selectedElement } : {}),
                                  ...(canvasState ? { canvasState } : {}),
                                  signal: abortController.signal,
                              })
                            : await generationAPI.applyProjectFix({
                                  projectId: activeProjectId,
                                  versionId: activeProjectVersionId,
                                  errorMessage: errorMessage ?? '',
                                  ...(stack ? { stack } : {}),
                                  signal: abortController.signal,
                              })

                    if (abortController.signal.aborted) {
                        return
                    }

                    hydrateAppliedProjectChange(result)
                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
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
            hydrateAppliedProjectChange,
            queryClient,
            resetGenerationRefs,
            setAssistantError,
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
                setView('chat')
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
                setView('chat')
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
            anchor.download = result.fileName
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            setProjectLoadError(
                error instanceof Error ? error.message : 'Failed to download project'
            )
        }
    }, [activeProjectId])

    const handleNewThread = () => {
        requireAuthOr(() => {
            outputOriginViewRef.current = 'chat'
            setView('chat')
            setMessages([])
            clearOpenedProject()
            resetGenerationFlow()
        })
    }

    const handleNavigate = (target: ViewState) => {
        requireAuthOr(() => {
            setView(target)
        })
    }

    const handleSignOut = () => {
        abortGenerationRequest()
        clearAuthToken()
        setAuthTokenState(null)
        queryClient.removeQueries({ queryKey: ['projects'] })
        queryClient.removeQueries({ queryKey: ['profile'] })
        outputOriginViewRef.current = 'chat'
        setView('chat')
        setMessages([])
        clearOpenedProject()
        resetGenerationFlow()
    }

    const isHome = view === 'chat' && messages.length === 0 && !isProjectOpening
    const showSidebar = !(!isHome && view === 'chat')
    const isProjectsInitialLoading = isProjectsLoading && projects.length === 0
    const projectsErrorMessage = projectsError instanceof Error ? projectsError.message : null

    const handleBackFromOutput = () => {
        const nextView = outputOriginViewRef.current
        clearOpenedProject()
        setMessages([])
        resetGenerationFlow()
        setView(nextView)
    }

    return {
        queryClient,
        view,
        setView,
        messages,
        generatedFiles,
        activeGeneratedFilePath,
        generationPhase,
        activeOperation,
        isGenerating,
        authToken,
        setAuthTokenState,
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
        projectVersions,
        activeProjectVersionId,
        isProjectOpening,
        projectLoadError,
        previewSession,
        previewSessionError,
        handleNewThread,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleOutputPromptSubmit,
        handlePreviewRuntimeError,
        handleBackFromOutput,
        handleOpenProject,
        handleSelectVersion,
        handleDownloadProject,
    }
}
