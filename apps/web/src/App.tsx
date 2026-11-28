import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppContentView } from './app/components/AppContentView'
import { AppSideNavigation } from './app/components/AppSideNavigation'
import { useAppController } from './app/hooks/useAppController'
import { AuthModal } from './features/auth/components/AuthModal'
import { githubOAuth } from './features/auth/githubOAuth'
import {
    InAppPage,
    NotFoundPage,
    SessionNotFoundPage,
} from './features/errors/components/NotFoundPage'
import { PanelErrorBoundary } from './features/errors/components/PanelErrorBoundary'
import { OnboardingPage } from './features/onboarding/components/OnboardingPage'
import { profileAPI } from './features/profile/api/profile'
import { useFinishSound } from './features/profile/hooks/useFinishSound'
import { SuperCrewCard } from './features/supercrew/components/SuperCrewCard'

import { useAppStore } from '@/app/store'
import { getViewForPath, isAppPath } from '@/app/types'
import { LogoLoader } from '@/shared/components/ui/LogoLoader'
import { getWebUrl } from '@/shared/config/env'
import { resetUserQueryCache } from '@/shared/lib/query-cache'
import { useDelayedFlag } from '@/shared/lib/useDelayedFlag'

// the admin panel (#624) is a separate screen; its code loads only when it is opened
const AdminPage = React.lazy(() =>
    import('./features/admin/components/AdminPage').then((m) => ({ default: m.AdminPage }))
)

/** opening a session faster than this shows no loader, so the screen does not blink */
const OPEN_LOADER_DELAY_MS = 300

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
        handleOpenFile,
        resetImportState,
        needsOnboarding,
        isOnboardingRoute,
        isCheckingOnboarding,
        isSessionNotFound,
    } = useAppController()

    // the finish sound from Settings, Preferences
    useFinishSound()

    const location = useLocation()
    const navigate = useNavigate()
    // the same cached profile the controller loads; only the admin's has adminPath
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: isAuthenticated,
    })
    const adminPath = profile?.isAdmin ? profile.adminPath : undefined
    const activeProjectId = useAppStore((s) => s.activeProjectId)

    // opening a session from inside the app keeps the current page until the session is
    // ready; the full-screen loader only shows when that is slow. a session link opened
    // directly has nothing to keep on screen, so it shows the loader at once.
    const isSlowOpen = useDelayedFlag(isProjectOpening, OPEN_LOADER_DELAY_MS)
    const isLinkOpen =
        isProjectOpening && !activeProjectId && getViewForPath(location.pathname) === 'project'
    const showOpeningLoader = isSlowOpen || isLinkOpen

    // the admin path is a known page only for the admin; for anyone else it is unknown
    const isUnknownPath =
        !isAppPath(location.pathname) && !(adminPath && location.pathname === adminPath)

    if (!isAuthRestored) {
        return <LogoLoader />
    }

    // signed out: an unknown path shows the page full screen, and home is the landing page
    if (!isAuthenticated && isUnknownPath) {
        return (
            <div className="fixed inset-0 bg-[#141414] font-sans">
                <NotFoundPage onGoHome={() => window.location.assign(getWebUrl())} />
            </div>
        )
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

    // the admin panel lives at a path only the admin is told; for anyone else it is a
    // normal unknown path
    if (adminPath && location.pathname === adminPath) {
        return (
            <React.Suspense fallback={<LogoLoader />}>
                <AdminPage />
            </React.Suspense>
        )
    }

    return (
        <>
            {showOpeningLoader && <LogoLoader />}
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

                <SuperCrewCard isHome={isHome && !isUnknownPath} />

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
                    {isUnknownPath ? (
                        <InAppPage>
                            <NotFoundPage onGoHome={handleHomeClick} />
                        </InAppPage>
                    ) : isSessionNotFound ? (
                        <InAppPage>
                            <SessionNotFoundPage
                                onGoToSessions={() => handleNavigate('sessions')}
                            />
                        </InAppPage>
                    ) : (
                        // P4: a page that crashes keeps the sidebar; going to another page
                        // tries again
                        <PanelErrorBoundary
                            title="This page could not load"
                            size="page"
                            resetKey={location.pathname}
                            mobileTopBar
                        >
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
                                onSignOut={handleSignOut}
                                onOpenFile={handleOpenFile}
                                onResetImportState={resetImportState}
                            />
                        </PanelErrorBoundary>
                    )}
                </div>
            </div>
        </>
    )
}

export default App
