import React from 'react'

import Sidebar from '@/features/navigation/components/Sidebar'
import { MobileSidebar } from '@/features/navigation/components/MobileSidebar'
import { Icons } from '@/shared/components/ui/Icons'
import type { Project } from '@/features/projects/types'
import type { ViewState } from '@/app/types'

interface AppSideNavigationProps {
    showSidebar: boolean
    isMobileSidebarOpen: boolean
    setIsMobileSidebarOpen: (isOpen: boolean) => void
    onNewThread: () => void
    onNavigate: (target: ViewState) => void
    onOpenProject: (projectId: string) => void
    isAuthenticated: boolean
    onOpenAuth: () => void
    projects: Project[]
    isProjectsInitialLoading: boolean
}

export const AppSideNavigation: React.FC<AppSideNavigationProps> = ({
    showSidebar,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    onNewThread,
    onNavigate,
    onOpenProject,
    isAuthenticated,
    onOpenAuth,
    projects,
    isProjectsInitialLoading,
}) => {
    if (!showSidebar) {
        return null
    }

    return (
        <>
            <Sidebar
                onNewThread={onNewThread}
                onAllProjects={() => onNavigate('all-projects')}
                onTemplates={() => onNavigate('templates')}
                onDesignSystems={() => onNavigate('design-systems')}
                onDocs={() => onNavigate('docs')}
                onProfile={() => onNavigate('profile')}
                onOpenProject={onOpenProject}
                isAuthenticated={isAuthenticated}
                onOpenAuth={onOpenAuth}
                projects={projects}
                isProjectsLoading={isProjectsInitialLoading}
            />

            <div className="md:hidden fixed top-4 left-4 z-50">
                <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="p-2 bg-[#1F1F1F] rounded-md border border-white/10 text-white shadow-lg"
                >
                    <Icons.SidebarToggle />
                </button>
            </div>

            <MobileSidebar
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
                onNewThread={onNewThread}
                onAllProjects={() => onNavigate('all-projects')}
                onTemplates={() => onNavigate('templates')}
                onDesignSystems={() => onNavigate('design-systems')}
                onDocs={() => onNavigate('docs')}
                onProfile={() => onNavigate('profile')}
                onOpenProject={onOpenProject}
                isAuthenticated={isAuthenticated}
                onOpenAuth={onOpenAuth}
                projects={projects}
                isProjectsLoading={isProjectsInitialLoading}
            />
        </>
    )
}
