import React, { useState } from 'react'
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
import { INITIAL_PROJECTS } from './constants/projects'

type ViewState = 'chat' | 'all-projects' | 'profile'

const App: React.FC = () => {
    const [view, setView] = useState<ViewState>('chat')
    const [messages, setMessages] = useState<Message[]>([])
    const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS)
    const [isGenerating, setIsGenerating] = useState(false)
    const [currentCode, setCurrentCode] = useState<string>('')

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [showAuthModal, setShowAuthModal] = useState(false)
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

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
        setIsAuthenticated(false)
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
                code: code,
            }

            setCurrentCode(code)
            setMessages((prev) => [...prev, assistantMsg])
            setIsGenerating(false)
        }, 1500)
    }

    const isHome = view === 'chat' && messages.length === 0
    const showSidebar = !(!isHome && view === 'chat')

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
            />

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onAuthSuccess={() => {
                    setIsAuthenticated(true)
                    setShowAuthModal(false)
                }}
            />

            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                {view === 'all-projects' && (
                    <ProjectList
                        onNewProject={handleNewThread}
                        projects={projects}
                        setProjects={setProjects}
                    />
                )}

                {view === 'profile' && <ProfileSettings onSignOut={handleSignOut} />}

                {view === 'chat' &&
                    (isHome ? (
                        <HomeHero
                            onPromptSubmit={handlePromptSubmit}
                            isGenerating={isGenerating}
                            isAuthenticated={isAuthenticated}
                            onOpenAuth={() => setShowAuthModal(true)}
                        />
                    ) : (
                        <OutputScreen
                            onBack={() => {
                                setView('chat')
                                setMessages([])
                            }}
                            isGenerating={isGenerating}
                        />
                    ))}
            </div>
        </div>
    )
}

export default App
