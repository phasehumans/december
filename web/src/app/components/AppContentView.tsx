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

import { DocsPage } from '@/features/docs/components/DocsPage'
import { HomeHero } from '@/features/home/components/HomeHero'
import { OutputScreen } from '@/features/preview/components/OutputScreen'
import { ProfileSettings } from '@/features/profile/components/ProfileSettings'
import { ProjectList } from '@/features/projects/components/ProjectList'
import { TemplatesView } from '@/features/templates/components/TemplatesView'

interface AppContentViewProps {
    view: ViewState
    isHome: boolean
    messages: Message[]
    generatedFiles: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath: string | null
    generationPhase: 'thinking' | 'planning' | 'building' | 'done' | null
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
    onSelectVersion: (versionId: string) => void
    onDownloadProject: () => void
    onSignOut: () => void
    onDocs?: () => void
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
    onSelectVersion,
    onDownloadProject,
    onSignOut,
    onDocs,
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
                    />
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

            {view === 'design-systems' && (
                <AnimatedPage pageKey="design-systems">
                    <div className="h-full flex items-center justify-center">
                        <span className="text-xl font-medium text-[#D6D5D4]">Design Systems</span>
                    </div>
                </AnimatedPage>
            )}

            {view === 'docs' && (
                <AnimatedPage pageKey="docs">
                    <DocsPage onBack={onNewProject} />
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
                            previewSessionError={previewSessionError}
                        />
                    </AnimatedPage>
                ))}
        </AnimatePresence>
    )
}
