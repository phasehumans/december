import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Message } from '@/features/chat/types'
import type { GenerationRequirements, ViewState } from '@/app/types'
import { PREVIEW_HTML } from '@/features/preview/constants/preview'
import { GENERATION_LOADER_DURATION_MS } from '@/features/preview/constants/generation'
import { clearAuthToken, getAuthToken } from '@/shared/api/client'
import { projectAPI } from '@/features/projects/api/project'
import { mapBackendProjectToUIProject } from '@/app/mapProject'

const defaultGenerationRequirements: GenerationRequirements = {
    needsDatabase: false,
    neonDatabaseUrl: '',
}

export const useAppController = () => {
    const queryClient = useQueryClient()

    const [view, setView] = React.useState<ViewState>('chat')
    const [messages, setMessages] = React.useState<Message[]>([])
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [authToken, setAuthTokenState] = React.useState<string | null>(() => getAuthToken())
    const [showAuthModal, setShowAuthModal] = React.useState(false)
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false)
    const [showGenerationRequirementsModal, setShowGenerationRequirementsModal] =
        React.useState(false)
    const [pendingPrompt, setPendingPrompt] = React.useState<string | null>(null)
    const [pendingPromptMessageId, setPendingPromptMessageId] = React.useState<string | null>(null)
    const [generationRequirements, setGenerationRequirements] =
        React.useState<GenerationRequirements>(defaultGenerationRequirements)
    const [generationRequirementsError, setGenerationRequirementsError] = React.useState<
        string | null
    >(null)
    const generationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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

    const clearGenerationTimeout = React.useCallback(() => {
        if (generationTimeoutRef.current) {
            clearTimeout(generationTimeoutRef.current)
            generationTimeoutRef.current = null
        }
    }, [])

    React.useEffect(() => {
        return () => {
            clearGenerationTimeout()
        }
    }, [clearGenerationTimeout])

    const requireAuthOr = (action: () => void) => {
        if (!isAuthenticated) {
            setShowAuthModal(true)
            return
        }

        action()
    }

    const resetGenerationFlow = React.useCallback(() => {
        setShowGenerationRequirementsModal(false)
        setPendingPrompt(null)
        setPendingPromptMessageId(null)
        setGenerationRequirements(defaultGenerationRequirements)
        setGenerationRequirementsError(null)
        setIsGenerating(false)
        clearGenerationTimeout()
    }, [clearGenerationTimeout])

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

            clearGenerationTimeout()
            setIsGenerating(false)

            if (pendingPromptMessageId) {
                setMessages((prev) =>
                    prev.filter((message) => message.id !== pendingPromptMessageId)
                )
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

            setPendingPrompt(normalizedPrompt)
            setPendingPromptMessageId(promptMessageId)
            setGenerationRequirements(defaultGenerationRequirements)
            setGenerationRequirementsError(null)
            setShowGenerationRequirementsModal(true)
        })
    }

    const handleGenerationRequirementsChange = (nextRequirements: GenerationRequirements) => {
        setGenerationRequirements(nextRequirements)
        setGenerationRequirementsError(null)
    }

    const handleGenerationRequirementsCancel = () => {
        if (pendingPromptMessageId) {
            setMessages((prev) => prev.filter((message) => message.id !== pendingPromptMessageId))
        }

        setShowGenerationRequirementsModal(false)
        setPendingPrompt(null)
        setPendingPromptMessageId(null)
        setGenerationRequirements(defaultGenerationRequirements)
        setGenerationRequirementsError(null)
        setIsGenerating(false)
        clearGenerationTimeout()
    }

    const handleGenerationRequirementsContinue = () => {
        if (!pendingPrompt) {
            setShowGenerationRequirementsModal(false)
            return
        }

        if (
            generationRequirements.needsDatabase &&
            !generationRequirements.neonDatabaseUrl.trim()
        ) {
            setGenerationRequirementsError('Please paste your NeonDB URL before continuing.')
            return
        }

        const dbSummary = generationRequirements.needsDatabase
            ? ` Database enabled with Neon URL: ${generationRequirements.neonDatabaseUrl.trim()}`
            : ' Database not requested.'

        clearGenerationTimeout()
        setShowGenerationRequirementsModal(false)
        setGenerationRequirementsError(null)
        setPendingPrompt(null)
        setPendingPromptMessageId(null)
        setIsGenerating(true)

        generationTimeoutRef.current = setTimeout(() => {
            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Generation complete for "${pendingPrompt}".${dbSummary}`,
                type: 'text',
                code: PREVIEW_HTML,
            }

            setMessages((prev) => [...prev, assistantMsg])
            setIsGenerating(false)
        }, GENERATION_LOADER_DURATION_MS)
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
        showGenerationRequirementsModal,
        generationRequirements,
        generationRequirementsError,
        handleNewThread,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleGenerationRequirementsChange,
        handleGenerationRequirementsCancel,
        handleGenerationRequirementsContinue,
        handleBackFromOutput,
    }
}
