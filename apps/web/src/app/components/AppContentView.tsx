import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'

import { CanvasPage } from '../../features/canvas/components/CanvasPage'
import { ReviewPage } from '../../features/sessions/components/ReviewPage'

import type { ViewState } from '@/app/types'
import type { PreviewRuntimeError, PreviewSelectedElement } from '@/features/preview/types'

import { DocsView } from '@/features/docs/components/DocsView'
import { HomeHero } from '@/features/home/components/HomeHero'
import { OutputScreen } from '@/features/preview/components/OutputScreen'
import { ProfileSettings } from '@/features/profile/components/ProfileSettings'
import { SessionList } from '@/features/sessions/components/SessionList'
import { TemplatesView } from '@/features/templates/components/TemplatesView'

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

            {(view === 'chat' || view === 'project') &&
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
        </AnimatePresence>
    )
}
