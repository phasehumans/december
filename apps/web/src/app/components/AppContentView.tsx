import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'

import { CanvasPage } from '../../features/canvas/components/CanvasPage'
import { ReviewPage } from '../../features/projects/components/ReviewPage'

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

import { HomeHero } from '@/features/home/components/HomeHero'
import { OutputScreen } from '@/features/preview/components/OutputScreen'
import { ProfileSettings } from '@/features/profile/components/ProfileSettings'
import { ProjectList } from '@/features/projects/components/ProjectList'
import { SessionList } from '@/features/projects/components/SessionList'
import { TemplatesView } from '@/features/templates/components/TemplatesView'
import { DocsView } from '@/features/docs/components/DocsView'

interface AppContentViewProps {
    view: ViewState
    isHome: boolean
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
    onHomePromptSubmit,
    onOutputPromptSubmit,
    onPreviewRuntimeError,
    onOpenAuth,
    onBackFromOutput,
    onNewProject,
    onOpenProject,
    onImportGithub,
    onImportZip,
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

            {view === 'docs' && (
                <AnimatedPage pageKey="docs">
                    <DocsView onBack={onNewProject} />
                </AnimatedPage>
            )}

            {view === 'canvas' && (
                <AnimatedPage pageKey="canvas">
                    <CanvasPage onBack={onNewProject} onOpenAuth={onOpenAuth} />
                </AnimatedPage>
            )}

            {view === 'chat' &&
                (isHome ? (
                    <AnimatedPage pageKey="chat-home">
                        <HomeHero
                            onPromptSubmit={onHomePromptSubmit}
                            onOpenAuth={onOpenAuth}
                            onImportGithub={onImportGithub}
                            onImportZip={onImportZip}
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
                            onSelectVersion={onSelectVersion}
                            onDownload={onDownloadProject}
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
