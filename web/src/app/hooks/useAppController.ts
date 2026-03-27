import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Message } from '@/features/chat/types'
import type { ViewState } from '@/app/types'
import { clearAuthToken, getAuthToken } from '@/shared/api/client'
import { generationAPI } from '@/features/generation/api/generation'
import {
    projectAPI,
    type BackendProjectDetail,
    type BackendProjectMessage,
    type BackendProjectVersionSummary,
} from '@/features/projects/api/project'
import { mapBackendProjectToUIProject } from '@/app/mapProject'
import type { GeneratedProjectFile } from '@/features/preview/types'

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
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [authToken, setAuthTokenState] = React.useState<string | null>(() => getAuthToken())
    const [showAuthModal, setShowAuthModal] = React.useState(false)
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false)
    const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null)
    const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null)
    const [projectVersions, setProjectVersions] = React.useState<BackendProjectVersionSummary[]>([])
    const [activeProjectVersionId, setActiveProjectVersionId] = React.useState<string | null>(null)
    const [isProjectOpening, setIsProjectOpening] = React.useState(false)
    const [projectLoadError, setProjectLoadError] = React.useState<string | null>(null)
    const generationAbortControllerRef = React.useRef<AbortController | null>(null)
    const activeAssistantMessageIdRef = React.useRef<string | null>(null)
    const activeGeneratedFilePathRef = React.useRef<string | null>(null)
    const activeGenerationPhaseRef = React.useRef<
        'thinking' | 'planning' | 'building' | 'done' | null
    >(null)
    const hasReceivedStreamErrorRef = React.useRef(false)
    const outputOriginViewRef = React.useRef<ViewState>('chat')

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
        (files: Record<string, string>) => {
            const paths = Object.keys(files)
            setGeneratedFiles(mapStoredFilesToGeneratedFiles(files))
            setActiveGeneratedFilePath(paths[paths.length - 1] ?? null)
        },
        [setActiveGeneratedFilePath]
    )

    const resetGeneratedOutput = React.useCallback(() => {
        setGeneratedFiles({})
        setActiveGeneratedFilePath(null)
    }, [setActiveGeneratedFilePath])

    const resetGenerationRefs = React.useCallback(() => {
        activeAssistantMessageIdRef.current = null
        activeGenerationPhaseRef.current = null
        hasReceivedStreamErrorRef.current = false
        setGenerationPhase(null)
    }, [])

    const clearOpenedProject = React.useCallback(() => {
        setActiveProjectId(null)
        setActiveProjectName(null)
        setProjectVersions([])
        setActiveProjectVersionId(null)
        setProjectLoadError(null)
        setIsProjectOpening(false)
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
            replaceGeneratedOutput(detail.generatedFiles)
            setGenerationPhase(null)
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

    const startGeneration = React.useCallback(
        (prompt: string, assistantMessageId: string, projectId?: string | null) => {
            abortGenerationRequest()
            resetGeneratedOutput()
            activeAssistantMessageIdRef.current = assistantMessageId
            activeGenerationPhaseRef.current = 'thinking'
            hasReceivedStreamErrorRef.current = false
            setGenerationPhase('thinking')
            setIsGenerating(true)
            setProjectLoadError(null)

            const abortController = new AbortController()
            generationAbortControllerRef.current = abortController

            void (async () => {
                try {
                    await generationAPI.generateProjectStream({
                        prompt,
                        isDB: false,
                        projectId,
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
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    return
                                case 'phase':
                                    if (event.data.phase === 'planning') {
                                        activeGenerationPhaseRef.current = 'planning'
                                        setGenerationPhase('planning')
                                        setAssistantStatus(activeMessageId, 'planning')
                                        ensureAssistantSpacing(activeMessageId)
                                    }

                                    if (event.data.phase === 'building') {
                                        activeGenerationPhaseRef.current = 'building'
                                        setGenerationPhase('building')
                                        setAssistantStatus(activeMessageId, 'building')
                                    }

                                    if (event.data.phase === 'done') {
                                        activeGenerationPhaseRef.current = 'done'
                                        setGenerationPhase('done')
                                        setAssistantStatus(activeMessageId, 'done')
                                    }

                                    return
                                case 'message-start':
                                    if (event.data.status === 'thinking') {
                                        activeGenerationPhaseRef.current = 'thinking'
                                        setGenerationPhase('thinking')
                                        setAssistantStatus(activeMessageId, 'thinking')
                                    }

                                    if (event.data.status === 'planning') {
                                        activeGenerationPhaseRef.current = 'planning'
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
                                    activeGenerationPhaseRef.current = 'done'
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
                                    hasReceivedStreamErrorRef.current = true
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
    }, [activeProjectId, activeProjectVersionId])

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

    const handlePromptSubmit = (prompt: string) => {
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
            startGeneration(normalizedPrompt, assistantMessageId, activeProjectId)
        })
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
        activeProjectName,
        projectVersions,
        activeProjectVersionId,
        isProjectOpening,
        projectLoadError,
        handleNewThread,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleBackFromOutput,
        handleOpenProject,
        handleSelectVersion,
        handleDownloadProject,
    }
}
