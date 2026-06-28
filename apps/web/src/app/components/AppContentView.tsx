import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'

import type { ViewState } from '@/app/types'
import type { CanvasDocument } from '@/features/canvas/types'
import type { Message } from '@/features/chat/types'
import type {
    GeneratedProjectFile,
    OutputOperation,
    PreviewRuntimeError,
    PreviewSelectedElement,
    PreviewSessionStatus,
} from '@/features/preview/types'
import type { BackendProjectVersionSummary } from '@/features/projects/api/project'
import type { Project } from '@/features/projects/types'

import { CliPage } from '@/features/docs/components/CliPage'
import { DocsPage } from '@/features/docs/components/DocsPage'
import { HomeHero } from '@/features/home/components/HomeHero'
import { OutputScreen } from '@/features/preview/components/OutputScreen'
import { ProfileSettings } from '@/features/profile/components/ProfileSettings'
import { ProjectList } from '@/features/projects/components/ProjectList'
import { ReviewPage } from '../../features/projects/components/ReviewPage'
import { SessionList } from '@/features/projects/components/SessionList'
import { TemplatesView } from '@/features/templates/components/TemplatesView'
import { CanvasPage } from '../../features/canvas/components/CanvasPage'

interface AppContentViewProps {
    view: ViewState
    isHome: boolean
    messages: Message[]
    generatedFiles: Record<string, GeneratedProjectFile>
    activeFilesToDisplay: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath: string | null
    generationPhase: 'thinking' | 'building' | 'done' | null
    activeOperation: OutputOperation | null
    isGenerating: boolean
    isAuthenticated: boolean
    projects: Project[]
    isProjectsInitialLoading: boolean
    isProjectsFetching: boolean
    projectsErrorMessage: string | null
    projectName: string | null
    activeProjectId: string | null
    canvasState: CanvasDocument
    onCanvasStateChange: (document: CanvasDocument) => void
    projectVersions: BackendProjectVersionSummary[]
    activeProjectVersionId: string | null
    isProjectOpening: boolean
    previewSession: PreviewSessionStatus | null
    previewSessionError: string | null
    onHomePromptSubmit: (prompt: string) => void
    onOutputPromptSubmit: (
        prompt: string,
        selectedElement?: PreviewSelectedElement
    ) => Promise<void> | void
    onPreviewRuntimeError: (error: PreviewRuntimeError) => Promise<void> | void
    onOpenAuth: () => void
    onBackFromOutput: () => void
    onNewProject: () => void
    onOpenProject: (projectId: string) => void
    onImportGithub: (repoUrl: string) => Promise<void> | void
    onImportZip: (file: File) => Promise<void> | void
    importState: {
        status: 'idle' | 'loading' | 'failed' | 'ready'
        message?: string | null
    }
    projectType: 'generated' | 'github' | 'zip'
    onSelectVersion: (versionId: string) => void
    onDownloadProject: () => void
    onSignOut: () => void
    onDocs?: () => void
    selectedModel?: string
    setSelectedModel?: (val: string) => void
    onOpenFile?: (path: string) => void
    onResetImportState?: () => void
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

const AnimatedPage: React.FC<{ pageKey: string; children: React.ReactNode }> = ({
    pageKey,
    children,
}) => {
    return (
        <motion.div
            key={pageKey}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="h-full min-h-0"
        >
            {children}
        </motion.div>
    )
}

export const AppContentView: React.FC<AppContentViewProps> = ({
    view,
    isHome,
    messages,
    generatedFiles,
    activeFilesToDisplay,
    activeGeneratedFilePath,
    generationPhase,
    activeOperation,
    isGenerating,
    isAuthenticated,
    projects,
    isProjectsInitialLoading,
    isProjectsFetching,
    projectsErrorMessage,
    projectName,
    activeProjectId,
    canvasState,
    onCanvasStateChange,
    projectVersions,
    activeProjectVersionId,
    isProjectOpening,
    previewSession,
    previewSessionError,
    onHomePromptSubmit,
    onOutputPromptSubmit,
    onPreviewRuntimeError,
    onOpenAuth,
    onBackFromOutput,
    onNewProject,
    onOpenProject,
    onImportGithub,
    onImportZip,
    importState,
    projectType,
    onSelectVersion,
    onDownloadProject,
    onSignOut,
    onDocs,
    selectedModel,
    setSelectedModel,
    onOpenFile,
    onResetImportState,
}) => {
    return (
        <AnimatePresence mode="wait" initial={false}>
            {view === 'all-projects' && (
                <AnimatedPage pageKey="all-projects">
                    <ProjectList
                        onNewProject={onNewProject}
                        onOpenProject={onOpenProject}
                        projects={projects}
                        isLoading={isProjectsInitialLoading}
                        isFetching={isProjectsFetching}
                        errorMessage={projectsErrorMessage}
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                    />
                </AnimatedPage>
            )}

            {view === 'sessions' && (
                <AnimatedPage pageKey="sessions">
                    <SessionList
                        onNewProject={onNewProject}
                        onOpenProject={onOpenProject}
                        projects={projects}
                        isLoading={isProjectsInitialLoading}
                        isFetching={isProjectsFetching}
                        errorMessage={projectsErrorMessage}
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                    />
                </AnimatedPage>
            )}

            {view === 'review' && (
                <AnimatedPage pageKey="review">
                    <ReviewPage onNewProject={onNewProject} />
                </AnimatedPage>
            )}

            {view === 'profile' && (
                <AnimatedPage pageKey="profile">
                    <ProfileSettings onSignOut={onSignOut} onBack={onNewProject} onDocs={onDocs} />
                </AnimatedPage>
            )}

            {view === 'templates' && (
                <AnimatedPage pageKey="templates">
                    <TemplatesView onOpenProject={onOpenProject} />
                </AnimatedPage>
            )}

            {view === 'cli' && (
                <AnimatedPage pageKey="cli">
                    <CliPage onBack={onNewProject} />
                </AnimatedPage>
            )}

            {view === 'docs' && (
                <AnimatedPage pageKey="docs">
                    <DocsPage onBack={onNewProject} />
                </AnimatedPage>
            )}

            {view === 'canvas' && (
                <AnimatedPage pageKey="canvas">
                    <CanvasPage
                        onBack={onNewProject}
                        canvasState={canvasState}
                        onCanvasStateChange={onCanvasStateChange}
                        isAuthenticated={isAuthenticated}
                        onOpenAuth={onOpenAuth}
                        projectId={activeProjectId}
                    />
                </AnimatedPage>
            )}

            {view === 'chat' &&
                (isHome ? (
                    <AnimatedPage pageKey="chat-home">
                        <HomeHero
                            onPromptSubmit={onHomePromptSubmit}
                            isGenerating={isGenerating}
                            isAuthenticated={isAuthenticated}
                            onOpenAuth={onOpenAuth}
                            canvasState={canvasState}
                            onCanvasStateChange={onCanvasStateChange}
                            projectId={activeProjectId}
                            onImportGithub={onImportGithub}
                            onImportZip={onImportZip}
                            importState={importState}
                            onResetImportState={onResetImportState}
                        />
                    </AnimatedPage>
                ) : (
                    <AnimatedPage pageKey="chat-output">
                        <OutputScreen
                            onBack={onBackFromOutput}
                            onPromptSubmit={(prompt, options) =>
                                onOutputPromptSubmit(prompt, options?.selectedElement)
                            }
                            onRuntimeError={onPreviewRuntimeError}
                            messages={messages}
                            generatedFiles={generatedFiles}
                            activeFilesToDisplay={activeFilesToDisplay}
                            activeGeneratedFilePath={activeGeneratedFilePath}
                            generationPhase={generationPhase}
                            activeOperation={activeOperation}
                            isGenerating={isGenerating}
                            projectName={projectName}
                            projectId={activeProjectId}
                            canvasState={canvasState}
                            onCanvasStateChange={onCanvasStateChange}
                            versions={projectVersions}
                            activeVersionId={activeProjectVersionId}
                            isVersionLoading={isProjectOpening}
                            onSelectVersion={onSelectVersion}
                            onDownload={onDownloadProject}
                            previewSession={previewSession}
                            projectType={projectType}
                            previewSessionError={
                                importState.status === 'failed'
                                    ? importState.message || 'Import failed'
                                    : previewSessionError
                            }
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            onOpenFile={onOpenFile}
                        />
                    </AnimatedPage>
                ))}

            {view === 'project' && (
                <AnimatedPage pageKey="project-output">
                    <OutputScreen
                        onBack={onBackFromOutput}
                        onPromptSubmit={(prompt, options) =>
                            onOutputPromptSubmit(prompt, options?.selectedElement)
                        }
                        onRuntimeError={onPreviewRuntimeError}
                        messages={messages}
                        generatedFiles={generatedFiles}
                        activeFilesToDisplay={activeFilesToDisplay}
                        activeGeneratedFilePath={activeGeneratedFilePath}
                        generationPhase={generationPhase}
                        activeOperation={activeOperation}
                        isGenerating={isGenerating}
                        projectName={projectName}
                        projectId={activeProjectId}
                        canvasState={canvasState}
                        onCanvasStateChange={onCanvasStateChange}
                        versions={projectVersions}
                        activeVersionId={activeProjectVersionId}
                        isVersionLoading={isProjectOpening}
                        onSelectVersion={onSelectVersion}
                        onDownload={onDownloadProject}
                        previewSession={previewSession}
                        projectType={projectType}
                        previewSessionError={
                            importState.status === 'failed'
                                ? importState.message || 'Import failed'
                                : previewSessionError
                        }
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                        onOpenFile={onOpenFile}
                    />
                </AnimatedPage>
            )}
        </AnimatePresence>
    )
}
