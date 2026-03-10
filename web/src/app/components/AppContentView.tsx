import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HomeHero } from '@/features/home/components/HomeHero'
import { OutputScreen } from '@/features/preview/components/OutputScreen'
import { ProjectList } from '@/features/projects/components/ProjectList'
import { ProfileSettings } from '@/features/profile/components/ProfileSettings'
import type { Project } from '@/features/projects/types'
import type { ViewState } from '@/app/types'

interface AppContentViewProps {
    view: ViewState
    isHome: boolean
    isGenerating: boolean
    isAuthenticated: boolean
    projects: Project[]
    isProjectsInitialLoading: boolean
    isProjectsFetching: boolean
    projectsErrorMessage: string | null
    onPromptSubmit: (prompt: string) => void
    onOpenAuth: () => void
    onBackFromOutput: () => void
    onNewProject: () => void
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
    isGenerating,
    isAuthenticated,
    projects,
    isProjectsInitialLoading,
    isProjectsFetching,
    projectsErrorMessage,
    onPromptSubmit,
    onOpenAuth,
    onBackFromOutput,
    onNewProject,
    onSignOut,
}) => {
    return (
        <AnimatePresence mode="wait" initial={false}>
            {view === 'all-projects' && (
                <AnimatedPage pageKey="all-projects">
                    <ProjectList
                        onNewProject={onNewProject}
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
                            onPromptSubmit={onPromptSubmit}
                            isGenerating={isGenerating}
                            isAuthenticated={isAuthenticated}
                            onOpenAuth={onOpenAuth}
                        />
                    </AnimatedPage>
                ) : (
                    <AnimatedPage pageKey="chat-output">
                        <OutputScreen onBack={onBackFromOutput} isGenerating={isGenerating} />
                    </AnimatedPage>
                ))}
        </AnimatePresence>
    )
}
