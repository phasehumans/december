import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppContentView } from './app/components/AppContentView'
import { AppSideNavigation } from './app/components/AppSideNavigation'
import { useAppController } from './app/hooks/useAppController'
import { AuthModal } from './features/auth/components/AuthModal'

import { Icons } from '@/shared/components/ui/Icons'

const App: React.FC = () => {
    const {
        queryClient,
        view,
        isAuthRestored,
        isProjectOpening,
        setIsAuthenticated,
        showAuthModal,
        setShowAuthModal,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        isAuthenticated,
        isHome,
        showSidebar,
        handleNewThread,
        handleHomeClick,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleOutputPromptSubmit,
        handlePreviewRuntimeError,
        handleBackFromOutput,
        handleOpenProject,
        handleSelectVersion,
        handleDownloadProject,
        handleOpenFile,
        resetImportState,
    } = useAppController()

    const location = useLocation()
    const navigate = useNavigate()

    if (!isAuthRestored) {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414] select-none">
                <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center justify-center animate-pulse">
                        <Icons.DecemberLogo
                            className="w-10 h-10 md:w-12 md:h-12 text-[#3A3A3A]"
                            strokeWidth={1.2}
                        />
                    </div>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        if (location.pathname === '/login' || location.pathname === '/signup') {
            return (
                <div className="fixed inset-0 z-[100] bg-[#141414] flex flex-col items-center justify-center font-roboto overflow-y-auto">
                    <AuthModal
                        isOpen={true}
                        initialMode={location.pathname === '/signup' ? 'signup' : 'login'}
                        onClose={() => {
                            const landingUrl =
                                process.env.DOCS_URL ||
                                process.env.LANDING_URL ||
                                'https://trydecember.com'
                            if (typeof window !== 'undefined') {
                                window.location.replace(landingUrl)
                            }
                        }}
                        onAuthSuccess={() => {
                            setIsAuthenticated(true)
                            setShowAuthModal(false)
                            queryClient.invalidateQueries({ queryKey: ['sessions'] })
                            queryClient.invalidateQueries({ queryKey: ['profile'] })
                            const searchParams = new URLSearchParams(window.location.search)
                            const redirectTarget = searchParams.get('redirect')
                            if (
                                redirectTarget &&
                                redirectTarget.startsWith('/') &&
                                !redirectTarget.startsWith('//')
                            ) {
                                navigate(redirectTarget, { replace: true })
                            } else {
                                navigate('/', { replace: true })
                            }
                        }}
                    />
                </div>
            )
        }

        return (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414] select-none">
                <div className="flex items-center justify-center animate-pulse">
                    <Icons.DecemberLogo
                        className="w-10 h-10 md:w-12 md:h-12 text-[#3A3A3A]"
                        strokeWidth={1.2}
                    />
                </div>
            </div>
        )
    }

    return (
        <>
            {isProjectOpening && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414] select-none">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex items-center justify-center animate-pulse">
                            <Icons.DecemberLogo
                                className="w-10 h-10 md:w-12 md:h-12 text-[#3A3A3A]"
                                strokeWidth={1.2}
                            />
                        </div>
                    </div>
                </div>
            )}
            <div className="flex w-full h-dvh bg-background text-textMain overflow-hidden font-sans">
                <AppSideNavigation
                    showSidebar={showSidebar}
                    currentView={view}
                    isMobileSidebarOpen={isMobileSidebarOpen}
                    setIsMobileSidebarOpen={setIsMobileSidebarOpen}
                    onNewThread={handleNewThread}
                    onHomeClick={handleHomeClick}
                    onNavigate={handleNavigate}
                    onOpenProject={handleOpenProject}
                    isAuthenticated={isAuthenticated}
                    onOpenAuth={() => setShowAuthModal(true)}
                    onSignOut={handleSignOut}
                    isWorkspaceScreen={!isHome && (view === 'chat' || view === 'project')}
                />

                <AuthModal
                    isOpen={showAuthModal}
                    onClose={() => setShowAuthModal(false)}
                    onAuthSuccess={() => {
                        setIsAuthenticated(true)
                        setShowAuthModal(false)
                        queryClient.invalidateQueries({ queryKey: ['sessions'] })
                        queryClient.invalidateQueries({ queryKey: ['profile'] })
                    }}
                />

                <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden">
                    <AppContentView
                        view={view}
                        isHome={isHome}
                        onHomePromptSubmit={handlePromptSubmit}
                        onOutputPromptSubmit={handleOutputPromptSubmit}
                        onPreviewRuntimeError={handlePreviewRuntimeError}
                        onOpenAuth={() => setShowAuthModal(true)}
                        onBackFromOutput={handleBackFromOutput}
                        onNewProject={handleNewThread}
                        onOpenProject={handleOpenProject}
                        onSelectVersion={handleSelectVersion}
                        onDownloadProject={handleDownloadProject}
                        onSignOut={handleSignOut}
                        onOpenFile={handleOpenFile}
                        onResetImportState={resetImportState}
                    />
                </div>
            </div>
        </>
    )
}

export default App
