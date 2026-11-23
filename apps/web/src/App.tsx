import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppContentView } from './app/components/AppContentView'
import { AppSideNavigation } from './app/components/AppSideNavigation'
import { useAppController } from './app/hooks/useAppController'
import { AuthModal } from './features/auth/components/AuthModal'
import { githubOAuth } from './features/auth/githubOAuth'
import { OnboardingPage } from './features/onboarding/components/OnboardingPage'
import { SuperCrewCard } from './features/supercrew/components/SuperCrewCard'

import { LogoLoader } from '@/shared/components/ui/LogoLoader'
import { getWebUrl } from '@/shared/config/env'
import { resetUserQueryCache } from '@/shared/lib/query-cache'

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
        needsOnboarding,
        isOnboardingRoute,
        isCheckingOnboarding,
    } = useAppController()

    const location = useLocation()
    const navigate = useNavigate()

    if (!isAuthRestored) {
        return <LogoLoader />
    }

    if (!isAuthenticated) {
        if (location.pathname === '/login' || location.pathname === '/signup') {
            return (
                <div className="fixed inset-0 z-[100] bg-[#141414] flex flex-col items-center justify-center font-sans overflow-y-auto">
                    <AuthModal
                        isOpen={true}
                        initialMode={location.pathname === '/signup' ? 'signup' : 'login'}
                        onClose={() => {
                            const landingUrl = getWebUrl()
                            if (typeof window !== 'undefined') {
                                window.location.replace(landingUrl)
                            }
                        }}
                        onAuthSuccess={() => {
                            setIsAuthenticated(true)
                            setShowAuthModal(false)
                            // drop anything cached for a previous account before loading this one
                            resetUserQueryCache(queryClient)
                            const searchParams = new URLSearchParams(window.location.search)
                            const redirectTarget = searchParams.get('redirect')
                            if (githubOAuth.isSafeReturnPath(redirectTarget)) {
                                navigate(redirectTarget, { replace: true })
                            } else {
                                navigate('/', { replace: true })
                            }
                        }}
                    />
                </div>
            )
        }

        return <LogoLoader />
    }

    // wait for the profile so home never flashes before the onboarding redirect
    if (isCheckingOnboarding) {
        return <LogoLoader />
    }

    if (isOnboardingRoute) {
        return <OnboardingPage />
    }

    if (needsOnboarding) {
        return <LogoLoader />
    }

    return (
        <>
            {isProjectOpening && <LogoLoader />}
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

                <SuperCrewCard isHome={isHome} />

                <AuthModal
                    isOpen={showAuthModal}
                    onClose={() => setShowAuthModal(false)}
                    onAuthSuccess={() => {
                        setIsAuthenticated(true)
                        setShowAuthModal(false)
                        resetUserQueryCache(queryClient)
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
