import React from 'react'

import { AppContentView } from './app/components/AppContentView'
import { AppSideNavigation } from './app/components/AppSideNavigation'
import { useAppController } from './app/hooks/useAppController'
import { AuthModal } from './features/auth/components/AuthModal'

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
        setIsAuthenticated,
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
        importState,
        handleNewThread,
        handleNavigate,
        handleSignOut,
        handlePromptSubmit,
        handleOutputPromptSubmit,
        handlePreviewRuntimeError,
        handleImportGithub,
        handleImportZip,
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
                onSignOut={handleSignOut}
            />

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onAuthSuccess={() => {
                    setIsAuthenticated(true)
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
                    importState={importState}
                    onHomePromptSubmit={handlePromptSubmit}
                    onOutputPromptSubmit={handleOutputPromptSubmit}
                    onPreviewRuntimeError={handlePreviewRuntimeError}
                    onImportGithub={handleImportGithub}
                    onImportZip={handleImportZip}
                    onOpenAuth={() => setShowAuthModal(true)}
                    onBackFromOutput={handleBackFromOutput}
                    onNewProject={handleNewThread}
                    onOpenProject={handleOpenProject}
                    onSelectVersion={handleSelectVersion}
                    onDownloadProject={handleDownloadProject}
                    onSignOut={handleSignOut}
                    onDocs={() => handleNavigate('docs')}
                />
            </div>
        </div>
    )
}

export default App
