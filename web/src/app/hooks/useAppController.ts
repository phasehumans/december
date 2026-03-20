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
        setIsGenerating(false)
    }, [abortGenerationRequest])

    const appendAssistantMessage = React.useCallback(
        (messageId: string, status: 'thinking' | 'planning') => {
            setMessages((prev) => {
                const existingMessage = prev.find((message) => message.id === messageId)

                if (existingMessage) {
                    return prev.map((message) =>
                        message.id === messageId ? { ...message, status } : message
                    )
                }

                return [
                    ...prev,
                    {
                        id: messageId,
                        role: 'assistant',
                        content: '',
                        type: 'text',
                        status,
                    },
                ]
            })
        },
        []
    )

    const appendAssistantChunk = React.useCallback((messageId: string, chunk: string) => {
        setMessages((prev) =>
            prev.map((message) =>
                message.id === messageId
                    ? {
                          ...message,
                          content: `${message.content}${chunk}`,
                      }
                    : message
            )
        )
    }, [])

    const updateAssistantStatus = React.useCallback(
        (messageId: string, status: 'thinking' | 'planning' | 'done' | 'error') => {
            setMessages((prev) =>
                prev.map((message) =>
                    message.id === messageId
                        ? {
                              ...message,
                              status,
                          }
                        : message
                )
            )
        },
        []
    )

    const markStreamingMessagesAsError = React.useCallback(() => {
        setMessages((prev) =>
            prev.map((message) =>
                message.role === 'assistant' &&
                (message.status === 'thinking' || message.status === 'planning')
                    ? {
                          ...message,
                          status: 'error',
                      }
                    : message
            )
        )
    }, [])

    const appendErrorMessage = React.useCallback((message: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `${Date.now()}-error`,
                role: 'assistant',
                content: message,
                type: 'text',
                status: 'error',
            },
        ])
    }, [])

    const startGeneration = React.useCallback(
        (prompt: string) => {
            abortGenerationRequest()
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
                            switch (event.type) {
                                case 'connected':
                                    return
                                case 'project-created':
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    return
                                case 'phase':
                                    return
                                case 'message-start':
                                    appendAssistantMessage(event.data.messageId, event.data.status)
                                    return
                                case 'message-chunk':
                                    appendAssistantChunk(event.data.messageId, event.data.chunk)
                                    return
                                case 'message-complete':
                                    updateAssistantStatus(event.data.messageId, event.data.status)
                                    return
                                case 'result':
                                    void queryClient.invalidateQueries({ queryKey: ['projects'] })
                                    return
                                case 'error':
                                    return
                            }
                        },
                    })
                } catch (error) {
                    if (abortController.signal.aborted) {
                        return
                    }

                    markStreamingMessagesAsError()

                    const message =
                        error instanceof Error ? error.message : 'Generation failed unexpectedly.'
                    appendErrorMessage(message)
                } finally {
                    if (generationAbortControllerRef.current === abortController) {
                        generationAbortControllerRef.current = null
                    }

                    setIsGenerating(false)
                }
            })()
        },
        [
            abortGenerationRequest,
            appendAssistantChunk,
            appendAssistantMessage,
            appendErrorMessage,
            markStreamingMessagesAsError,
            queryClient,
            updateAssistantStatus,
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

            const promptMessageId = Date.now().toString()
            const userMsg: Message = {
                id: promptMessageId,
                role: 'user',
                content: normalizedPrompt,
            }

            if (shouldResetThread) {
                setMessages([userMsg])
            } else {
                setMessages((prev) => [...prev, userMsg])
            }

            startGeneration(normalizedPrompt)
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
