import { motion } from 'framer-motion'
import React from 'react'

import type { ViewState } from '@/app/types'
import type { PromptInputSubmitOptions } from '@/features/home/types'
import type { PreviewRuntimeError } from '@/features/preview/types'

import { HomeHero } from '@/features/home/components/HomeHero'

const loadWorkspaceScreen = () => import('@/features/preview/components/WorkspaceScreen')
const loadProfileSettings = () => import('@/features/profile/components/ProfileSettings')
const loadPullRequestsPage = () => import('@/features/pullrequests/components/PullRequestsPage')
const loadSessionList = () => import('@/features/sessions/components/SessionList')

const WorkspaceScreen = React.lazy(() =>
    loadWorkspaceScreen().then((m) => ({ default: m.WorkspaceScreen }))
)
const ProfileSettings = React.lazy(() =>
    loadProfileSettings().then((m) => ({ default: m.ProfileSettings }))
)
const PullRequestsPage = React.lazy(() =>
    loadPullRequestsPage().then((m) => ({ default: m.PullRequestsPage }))
)
const SessionList = React.lazy(() => loadSessionList().then((m) => ({ default: m.SessionList })))

/** fetch every page's code once the app is idle, so moving between pages never waits on it */
const preloadPages = () => {
    for (const load of [
        loadWorkspaceScreen,
        loadSessionList,
        loadPullRequestsPage,
        loadProfileSettings,
    ]) {
        load().catch((err) => {
            // the page loads again when it is opened; this was only a head start
            console.warn('Page preload failed', err)
        })
    }
}

interface AppContentViewProps {
    view: ViewState
    isHome: boolean
    onHomePromptSubmit: (prompt: string, options?: PromptInputSubmitOptions) => void
    onOutputPromptSubmit: (prompt: string) => Promise<void> | void
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
    duration: 0.15,
    ease: [0.22, 1, 0.36, 1] as const,
}

// the new page fades in; the old one goes at once, so there is no gap between them
const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
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
            transition={pageTransition}
            className="h-full min-h-0"
        >
            {children}
        </motion.div>
    )
}

// shown only if a page's code is not loaded yet. a plain background: a made-up layout
// would look like a different screen for a moment, mostly on phones
const RouteSuspenseFallback: React.FC = () => <div className="h-full w-full bg-background" />

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
    React.useEffect(() => {
        if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(preloadPages, { timeout: 2000 })
            return () => window.cancelIdleCallback(id)
        }
        const timer = setTimeout(preloadPages, 1000)
        return () => clearTimeout(timer)
    }, [])

    return (
        <React.Suspense fallback={<RouteSuspenseFallback />}>
            <>
                {view === 'sessions' && (
                    <AnimatedPage pageKey="sessions">
                        <SessionList onOpenProject={onOpenProject} />
                    </AnimatedPage>
                )}

                {view === 'pullrequests' && (
                    <AnimatedPage pageKey="pullrequests">
                        <PullRequestsPage onOpenProject={onOpenProject} />
                    </AnimatedPage>
                )}

                {view === 'profile' && (
                    <AnimatedPage pageKey="profile">
                        <ProfileSettings onSignOut={onSignOut} onBack={onNewProject} />
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
                                onPromptSubmit={onOutputPromptSubmit}
                                onRuntimeError={onPreviewRuntimeError}
                                onSelectVersion={onSelectVersion}
                                onDownload={onDownloadProject}
                                onOpenFile={onOpenFile}
                            />
                        </AnimatedPage>
                    ))}
            </>
        </React.Suspense>
    )
}
