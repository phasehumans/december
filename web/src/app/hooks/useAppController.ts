import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Message } from '@/features/chat/types'
import type { ViewState } from '@/app/types'
import { clearAuthToken, getAuthToken } from '@/shared/api/client'
import { generationAPI } from '@/features/generation/api/generation'
import { projectAPI } from '@/features/projects/api/project'
import { mapBackendProjectToUIProject } from '@/app/mapProject'

export const useAppController = () => {
    const queryClient = useQueryClient()

    const [view, setView] = React.useState<ViewState>('chat')
    const [messages, setMessages] = React.useState<Message[]>([])
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [authToken, setAuthTokenState] = React.useState<string | null>(() => getAuthToken())
    const [showAuthModal, setShowAuthModal] = React.useState(false)
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false)
    const generationAbortControllerRef = React.useRef<AbortController | null>(null)
    const activeAssistantMessageIdRef = React.useRef<string | null>(null)
    const activeGenerationPhaseRef = React.useRef<'thinking' | 'planning' | 'building' | null>(
        null
    )

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
            updateAssistantMessage(messageId, (message) => ({
                ...message,
                status: 'error',
                content: message.content.trim()
                    ? `${message.content.trim()}\n\n${errorMessage}`
                    : errorMessage,
            }))
        },
        [updateAssistantMessage]
    )

    const resetGenerationRefs = React.useCallback(() => {
        activeAssistantMessageIdRef.current = null
        activeGenerationPhaseRef.current = null
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

    const resetGenerationFlow = React.useCallback(() => {
        abortGenerationRequest()
        resetGenerationRefs()
        setIsGenerating(false)
    }, [abortGenerationRequest, resetGenerationRefs])

    const startGeneration = React.useCallback(
        (prompt: string, assistantMessageId: string) => {
            abortGenerationRequest()
            activeAssistantMessageIdRef.current = assistantMessageId
            activeGenerationPhaseRef.current = 'thinking'
            setIsGenerating(true)

            const abortController = new AbortController()
            generationAbortControllerRef.current = abortController

            void (async () => {
                try {
                    await generationAPI.generateProjectStream({
                        prompt,
                        isDB: false,
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
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    return
                                case 'phase':
                                    if (event.data.phase === 'planning') {
                                        activeGenerationPhaseRef.current = 'planning'
                                        setAssistantStatus(activeMessageId, 'planning')
                                        ensureAssistantSpacing(activeMessageId)
                                    }

                                    if (event.data.phase === 'done') {
                                        activeGenerationPhaseRef.current = 'building'
                                        setAssistantStatus(activeMessageId, 'building')
                                    }

                                    return
                                case 'message-start':
                                    if (event.data.status === 'thinking') {
                                        activeGenerationPhaseRef.current = 'thinking'
                                        setAssistantStatus(activeMessageId, 'thinking')
                                    }

                                    if (event.data.status === 'planning') {
                                        activeGenerationPhaseRef.current = 'planning'
                                        setAssistantStatus(activeMessageId, 'planning')
                                        ensureAssistantSpacing(activeMessageId)
                                    }

                                    return
                                case 'message-chunk':
                                    appendAssistantChunk(activeMessageId, event.data.chunk)
                                    return
                                case 'message-complete':
                                    if (activeGenerationPhaseRef.current === 'planning') {
                                        activeGenerationPhaseRef.current = 'building'
                                        setAssistantStatus(activeMessageId, 'building')
                                    }

                                    return
                                case 'result':
                                    activeGenerationPhaseRef.current = 'building'
                                    setAssistantStatus(activeMessageId, 'building')
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    return
                                case 'error':
                                    setAssistantError(activeMessageId, event.data.message)
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
            ensureAssistantSpacing,
            queryClient,
            resetGenerationRefs,
            setAssistantError,
            setAssistantStatus,
        ]
    )

    const handleNewThread = () => {
        requireAuthOr(() => {
            setView('chat')
            setMessages([])
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
        setView('chat')
        setMessages([])
        resetGenerationFlow()
    }

    const handlePromptSubmit = (prompt: string) => {
        requireAuthOr(() => {
            const normalizedPrompt = prompt.trim()
            if (!normalizedPrompt) {
                return
            }

            const shouldResetThread = view !== 'chat'
            if (shouldResetThread) {
                setView('chat')
            }

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

            if (shouldResetThread) {
                setMessages([userMsg, assistantMsg])
            } else {
                setMessages((prev) => [...prev, userMsg, assistantMsg])
            }

            startGeneration(normalizedPrompt, assistantMessageId)
        })
    }

    const isHome = view === 'chat' && messages.length === 0
    const showSidebar = !(!isHome && view === 'chat')
    const isProjectsInitialLoading = isProjectsLoading && projects.length === 0
    const projectsErrorMessage = projectsError instanceof Error ? projectsError.message : null

    const handleBackFromOutput = () => {
        setView('chat')
        setMessages([])
        resetGenerationFlow()
    }

    return {
        queryClient,
        view,
        setView,
        messages,
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
        handleNewThread,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleBackFromOutput,
    }
}
