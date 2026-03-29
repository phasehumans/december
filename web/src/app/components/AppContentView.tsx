import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HomeHero } from '@/features/home/components/HomeHero'
import { OutputScreen } from '@/features/preview/components/OutputScreen'
import { ProjectList } from '@/features/projects/components/ProjectList'
import { ProfileSettings } from '@/features/profile/components/ProfileSettings'
import type { Message } from '@/features/chat/types'
import type { Project } from '@/features/projects/types'
import type { ViewState } from '@/app/types'
import type {
    GeneratedProjectFile,
    OutputOperation,
    PreviewRuntimeError,
    PreviewSelectedElement,
    PreviewSessionStatus,
} from '@/features/preview/types'
import type { BackendProjectVersionSummary } from '@/features/projects/api/project'

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
    onSelectVersion: (versionId: string) => void
    onDownloadProject: () => void
    onSignOut: () => void
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
    onSelectVersion,
    onDownloadProject,
    onSignOut,
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
                    <ProfileSettings onSignOut={onSignOut} />
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
