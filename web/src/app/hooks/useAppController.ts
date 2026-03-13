import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Message } from '@/features/chat/types'
import type { ViewState } from '@/app/types'
import { PREVIEW_HTML } from '@/features/preview/constants/preview'
import { clearAuthToken, getAuthToken } from '@/shared/api/client'
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

    const requireAuthOr = (action: () => void) => {
        if (!isAuthenticated) {
            setShowAuthModal(true)
            return
        }

        action()
    }

    const handleNewThread = () => {
        requireAuthOr(() => {
            setView('chat')
            setMessages([])
            setIsGenerating(false)
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
    }

    const handlePromptSubmit = (prompt: string) => {
        requireAuthOr(() => {
            if (view !== 'chat') {
                setView('chat')
                setMessages([])
            }

            const userMsg: Message = { id: Date.now().toString(), role: 'user', content: prompt }
            setMessages((prev) => [...prev, userMsg])
            setIsGenerating(true)

            setTimeout(() => {
                const assistantMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content:
                        "I've crafted a high-fidelity landing page for Acme Corp. It features a dark-themed aesthetic, dynamic metrics grid, and a responsive navbar.",
                    type: 'text',
                    code: PREVIEW_HTML,
                }

                setMessages((prev) => [...prev, assistantMsg])
                setIsGenerating(false)
            }, 1500)
        })
    }

    const isHome = view === 'chat' && messages.length === 0
    const showSidebar = !(!isHome && view === 'chat')
    const isProjectsInitialLoading = isProjectsLoading && projects.length === 0
    const projectsErrorMessage = projectsError instanceof Error ? projectsError.message : null

    const handleBackFromOutput = () => {
        setView('chat')
        setMessages([])
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
        handleNewThread,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleBackFromOutput,
    }
}
