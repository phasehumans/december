import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'

import type { ViewState } from '@/app/types'
import type { PreviewRuntimeError, PreviewSelectedElement } from '@/features/preview/types'

import { HomeHero } from '@/features/home/components/HomeHero'
import { Skeleton } from '@/shared/components/ui/Skeleton'

const WorkspaceScreen = React.lazy(() =>
    import('@/features/preview/components/WorkspaceScreen').then((m) => ({
        default: m.WorkspaceScreen,
    }))
)
const ProfileSettings = React.lazy(() =>
    import('@/features/profile/components/ProfileSettings').then((m) => ({
        default: m.ProfileSettings,
    }))
)
const SearchSpaceScreen = React.lazy(() =>
    import('@/features/search/components/SearchSpaceScreen').then((m) => ({
        default: m.SearchSpaceScreen,
    }))
)
const SessionList = React.lazy(() =>
    import('@/features/sessions/components/SessionList').then((m) => ({ default: m.SessionList }))
)
const DocsView = React.lazy(() =>
    import('@/features/docs/components/DocsView').then((m) => ({ default: m.DocsView }))
)

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
    onSelectVersion: (versionId: string) => void
    onDownloadProject: () => void
    onSignOut: () => void
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

const RouteSuspenseFallback: React.FC = () => (
    <div className="h-full w-full bg-background flex flex-col p-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-6 w-36 bg-white/[0.04] rounded-lg" />
            <Skeleton className="h-8 w-24 bg-white/[0.03] rounded-lg" />
        </div>
        <div className="flex flex-col gap-3 flex-1">
            <Skeleton className="h-10 w-full bg-white/[0.025] rounded-xl" />
            <Skeleton className="h-24 w-full bg-white/[0.02] rounded-xl" />
            <Skeleton className="h-24 w-full bg-white/[0.02] rounded-xl" />
        </div>
    </div>
)

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
    onSelectVersion,
    onDownloadProject,
    onSignOut,
    onOpenFile,
    onResetImportState,
}) => {
    return (
        <React.Suspense fallback={<RouteSuspenseFallback />}>
            <AnimatePresence mode="wait" initial={false}>
                {view === 'sessions' && (
                    <AnimatedPage pageKey="sessions">
                        <SessionList onNewProject={onNewProject} onOpenProject={onOpenProject} />
                    </AnimatedPage>
                )}

                {view === 'profile' && (
                    <AnimatedPage pageKey="profile">
                        <ProfileSettings onSignOut={onSignOut} onBack={onNewProject} />
                    </AnimatedPage>
                )}

                {view === 'search' && (
                    <AnimatedPage pageKey="search">
                        <SearchSpaceScreen onBack={onNewProject} />
                    </AnimatedPage>
                )}

                {view === 'docs' && (
                    <AnimatedPage pageKey="docs">
                        <DocsView onBack={onNewProject} />
                    </AnimatedPage>
                )}

                {(view === 'chat' || view === 'project') &&
                    (isHome ? (
                        <AnimatedPage pageKey="chat-home">
                            <HomeHero
                                onPromptSubmit={onHomePromptSubmit}
                                onOpenAuth={onOpenAuth}
                                onOpenProject={onOpenProject}
                                onResetImportState={onResetImportState}
                            />
                        </AnimatedPage>
                    ) : (
                        <AnimatedPage pageKey="chat-output">
                            <WorkspaceScreen
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
        </React.Suspense>
    )
}
