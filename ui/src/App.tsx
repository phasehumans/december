import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Sidebar from './components/Sidebar'
import { MobileSidebar } from './components/MobileSidebar'
import { AuthModal } from './components/AuthModal'
import { OutputScreen } from './components/OutputScreen'
import { Icons } from './components/ui/Icons'

// Features
import { HomeHero } from './components/features/home/HomeHero'
import { ProjectList } from './components/features/projects/ProjectList'
import { ProfileSettings } from './components/features/profile/ProfileSettings'

// Services & Types
import type { Message, Project } from './types'
import { PREVIEW_HTML } from './constants/preview'
import { clearAuthToken, getAuthToken, setAuthToken } from './api/client'
import { projectAPI, type BackendProject } from './api/project'

type ViewState = 'chat' | 'all-projects' | 'profile'

const mapBackendProjectToUIProject = (project: BackendProject): Project => {
    const updatedAt = new Date(project.updatedAt)

    return {
        id: project.id,
        title: project.name,
        description: project.description ?? '',
        isStarred: project.isStarred,
        updatedAt: updatedAt.toLocaleString(),
    }
}

const pageTransition = {
    duration: 0.22,
    ease: [0.22, 1, 0.36, 1] as const,
}

const pageVariants = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
}

const App: React.FC = () => {
    const queryClient = useQueryClient()

    const [view, setView] = useState<ViewState>('chat')
    const [messages, setMessages] = useState<Message[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [currentCode, setCurrentCode] = useState<string>('')
    const [authToken, setAuthTokenState] = useState<string | null>(() => getAuthToken())

    const [showAuthModal, setShowAuthModal] = useState(false)
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

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
            backendProjects
                .map(mapBackendProjectToUIProject)
                .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })),
    })

    // Navigation Handlers
    const handleNewThread = () => {
        if (!isAuthenticated) {
            setShowAuthModal(true)
            return
        }
        setView('chat')
        setMessages([])
        setCurrentCode('')
        setIsGenerating(false)
    }

    const handleNav = (target: ViewState) => {
        if (!isAuthenticated) {
            setShowAuthModal(true)
            return
        }
        setView(target)
    }

    const handleSignOut = () => {
        clearAuthToken()
        setAuthTokenState(null)
        queryClient.removeQueries({ queryKey: ['projects'] })
        queryClient.removeQueries({ queryKey: ['profile'] })
        setView('chat')
        setMessages([])
        setCurrentCode('')
    }

    // Logic
    const handlePromptSubmit = async (prompt: string) => {
        if (!isAuthenticated) {
            setShowAuthModal(true)
            return
        }

        if (view !== 'chat') {
            setView('chat')
            setMessages([])
        }

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: prompt }
        setMessages((prev) => [...prev, userMsg])
        setIsGenerating(true)

        // Simulate network delay for better UX
        setTimeout(() => {
            const code = PREVIEW_HTML

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content:
                    "I've crafted a high-fidelity landing page for Acme Corp. It features a dark-themed aesthetic, dynamic metrics grid, and a responsive navbar.",
                type: 'text',
                code,
            }

            setCurrentCode(code)
            setMessages((prev) => [...prev, assistantMsg])
            setIsGenerating(false)
        }, 1500)
    }

    const isHome = view === 'chat' && messages.length === 0
    const showSidebar = !(!isHome && view === 'chat')
    const isProjectsInitialLoading = isProjectsLoading && projects.length === 0

    return (
        <div className="flex w-full h-screen bg-background text-textMain overflow-hidden font-sans selection:bg-accent selection:text-black">
            {showSidebar && (
                <Sidebar
                    onNewThread={handleNewThread}
                    onAllProjects={() => handleNav('all-projects')}
                    onProfile={() => handleNav('profile')}
                    isAuthenticated={isAuthenticated}
                    onOpenAuth={() => setShowAuthModal(true)}
                    projects={projects}
                    isProjectsLoading={isProjectsInitialLoading}
                />
            )}

            {/* Mobile Sidebar Toggle - Only visible on mobile when sidebar should be shown */}
            {showSidebar && (
                <div className="md:hidden fixed top-4 left-4 z-50">
                    <button
                        onClick={() => setIsMobileSidebarOpen(true)}
                        className="p-2 bg-[#1F1F1F] rounded-md border border-white/10 text-white shadow-lg"
                    >
                        <Icons.SidebarToggle />
                    </button>
                </div>
            )}

            <MobileSidebar
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
                onNewThread={handleNewThread}
                onAllProjects={() => handleNav('all-projects')}
                onProfile={() => handleNav('profile')}
                isAuthenticated={isAuthenticated}
                onOpenAuth={() => setShowAuthModal(true)}
                projects={projects}
                isProjectsLoading={isProjectsInitialLoading}
            />

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onAuthSuccess={(token) => {
                    setAuthToken(token)
                    setAuthTokenState(token)
                    setShowAuthModal(false)
                    queryClient.invalidateQueries({ queryKey: ['projects'] })
                    queryClient.invalidateQueries({ queryKey: ['profile'] })
                }}
            />

            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                    {view === 'all-projects' && (
                        <motion.div
                            key="all-projects"
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={pageTransition}
                            className="h-full"
                        >
                            <ProjectList
                                onNewProject={handleNewThread}
                                projects={projects}
                                isLoading={isProjectsInitialLoading}
                                isFetching={isProjectsFetching}
                                errorMessage={
                                    projectsError instanceof Error ? projectsError.message : null
                                }
                            />
                        </motion.div>
                    )}

                    {view === 'profile' && (
                        <motion.div
                            key="profile"
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={pageTransition}
                            className="h-full"
                        >
                            <ProfileSettings onSignOut={handleSignOut} />
                        </motion.div>
                    )}

                    {view === 'chat' &&
                        (isHome ? (
                            <motion.div
                                key="chat-home"
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={pageTransition}
                                className="h-full"
                            >
                                <HomeHero
                                    onPromptSubmit={handlePromptSubmit}
                                    isGenerating={isGenerating}
                                    isAuthenticated={isAuthenticated}
                                    onOpenAuth={() => setShowAuthModal(true)}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="chat-output"
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={pageTransition}
                                className="h-full"
                            >
                                <OutputScreen
                                    onBack={() => {
                                        setView('chat')
                                        setMessages([])
                                    }}
                                    isGenerating={isGenerating}
                                />
                            </motion.div>
                        ))}
                </AnimatePresence>
            </div>
        </div>
    )
}

export default App
