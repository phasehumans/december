import React from 'react'

import { AppContentView } from './app/components/AppContentView'
import { AppSideNavigation } from './app/components/AppSideNavigation'
import { useAppController } from './app/hooks/useAppController'
import { AuthModal } from './features/auth/components/AuthModal'

const App: React.FC = () => {
    const {
        queryClient,
        view,
        setIsAuthenticated,
        showAuthModal,
        setShowAuthModal,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        isAuthenticated,
        isHome,
        showSidebar,
        selectedModel,
        setSelectedModel,
        handleNewThread,
        handleHomeClick,
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
        handleOpenFile,
        resetImportState,
    } = useAppController()

    return (
        <div className="flex w-full h-screen bg-background text-textMain overflow-hidden font-sans">
            <AppSideNavigation
                showSidebar={showSidebar}
                isMobileSidebarOpen={isMobileSidebarOpen}
                setIsMobileSidebarOpen={setIsMobileSidebarOpen}
                onNewThread={handleNewThread}
                onHomeClick={handleHomeClick}
                onNavigate={handleNavigate}
                onOpenProject={handleOpenProject}
                isAuthenticated={isAuthenticated}
                onOpenAuth={() => setShowAuthModal(true)}
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
                    onHomePromptSubmit={handlePromptSubmit}
                    onOutputPromptSubmit={handleOutputPromptSubmit}
                    onPreviewRuntimeError={handlePreviewRuntimeError}
                    onOpenAuth={() => setShowAuthModal(true)}
                    onBackFromOutput={handleBackFromOutput}
                    onNewProject={handleNewThread}
                    onOpenProject={handleOpenProject}
                    onImportGithub={handleImportGithub}
                    onImportZip={handleImportZip}
                    onSelectVersion={handleSelectVersion}
                    onDownloadProject={handleDownloadProject}
                    onSignOut={handleSignOut}
                    onDocs={() => handleNavigate('docs')}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    onOpenFile={handleOpenFile}
                    onResetImportState={resetImportState}
                />
            </div>
        </div>
    )
}

export default App
