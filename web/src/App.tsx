import React from 'react'
import { AuthModal } from './features/auth/components/AuthModal'
import { AppSideNavigation } from './app/components/AppSideNavigation'
import { AppContentView } from './app/components/AppContentView'
import { useAppController } from './app/hooks/useAppController'
import { setAuthToken } from './shared/api/client'

const App: React.FC = () => {
    const {
        queryClient,
        view,
        messages,
        generatedFiles,
        activeGeneratedFilePath,
        generationPhase,
        activeOperation,
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
        activeProjectId,
        activeProjectName,
        canvasState,
        setCanvasState,
        projectVersions,
        activeProjectVersionId,
        isProjectOpening,
        previewSession,
        previewSessionError,
        handleNewThread,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleOutputPromptSubmit,
        handlePreviewRuntimeError,
        handleBackFromOutput,
        handleOpenProject,
        handleSelectVersion,
        handleDownloadProject,
    } = useAppController()

    return (
        <div className="flex w-full h-screen bg-background text-textMain overflow-hidden font-sans selection:bg-accent selection:text-black">
            <AppSideNavigation
                showSidebar={showSidebar}
                isMobileSidebarOpen={isMobileSidebarOpen}
                setIsMobileSidebarOpen={setIsMobileSidebarOpen}
                onNewThread={handleNewThread}
                onNavigate={handleNavigate}
                onOpenProject={handleOpenProject}
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

            <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden">
                <AppContentView
                    view={view}
                    isHome={isHome}
                    messages={messages}
                    generatedFiles={generatedFiles}
                    activeGeneratedFilePath={activeGeneratedFilePath}
                    generationPhase={generationPhase}
                    activeOperation={activeOperation}
                    isGenerating={isGenerating}
                    isAuthenticated={isAuthenticated}
                    projects={projects}
                    isProjectsInitialLoading={isProjectsInitialLoading}
                    isProjectsFetching={isProjectsFetching}
                    projectsErrorMessage={projectsErrorMessage}
                    projectName={activeProjectName}
                    activeProjectId={activeProjectId}
                    canvasState={canvasState}
                    onCanvasStateChange={setCanvasState}
                    projectVersions={projectVersions}
                    activeProjectVersionId={activeProjectVersionId}
                    isProjectOpening={isProjectOpening}
                    previewSession={previewSession}
                    previewSessionError={previewSessionError}
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
                />
            </div>
        </div>
    )
}

export default App




