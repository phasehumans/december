import React from 'react'
import { AuthModal } from './features/auth/components/AuthModal'
import { GenerationRequirementsModal } from './features/home/components/GenerationRequirementsModal'
import { AppSideNavigation } from './app/components/AppSideNavigation'
import { AppContentView } from './app/components/AppContentView'
import { useAppController } from './app/hooks/useAppController'
import { setAuthToken } from './shared/api/client'

const App: React.FC = () => {
    const {
        queryClient,
        view,
        isGenerating,
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
    } = useAppController()

    return (
        <div className="flex w-full h-screen bg-background text-textMain overflow-hidden font-sans selection:bg-accent selection:text-black">
            <AppSideNavigation
                showSidebar={showSidebar}
                isMobileSidebarOpen={isMobileSidebarOpen}
                setIsMobileSidebarOpen={setIsMobileSidebarOpen}
                onNewThread={handleNewThread}
                onNavigate={handleNavigate}
                isAuthenticated={isAuthenticated}
                onOpenAuth={() => setShowAuthModal(true)}
                projects={projects}
                isProjectsInitialLoading={isProjectsInitialLoading}
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

            <GenerationRequirementsModal
                isOpen={showGenerationRequirementsModal}
                requirements={generationRequirements}
                errorMessage={generationRequirementsError}
                onClose={handleGenerationRequirementsCancel}
                onRequirementsChange={handleGenerationRequirementsChange}
                onContinue={handleGenerationRequirementsContinue}
            />

            <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden">
                <AppContentView
                    view={view}
                    isHome={isHome}
                    isGenerating={isGenerating}
                    isRequirementsModalOpen={showGenerationRequirementsModal}
                    isAuthenticated={isAuthenticated}
                    projects={projects}
                    isProjectsInitialLoading={isProjectsInitialLoading}
                    isProjectsFetching={isProjectsFetching}
                    projectsErrorMessage={projectsErrorMessage}
                    onPromptSubmit={handlePromptSubmit}
                    onOpenAuth={() => setShowAuthModal(true)}
                    onBackFromOutput={handleBackFromOutput}
                    onNewProject={handleNewThread}
                    onSignOut={handleSignOut}
                />
            </div>
        </div>
    )
}

export default App
