import React from 'react'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { ProjectListRow } from './ProjectListRow'
import type { Project } from '@/features/projects/types'

interface ProjectListViewProps {
    projects: Project[]
    onNewProject: () => void
    isInitialLoading: boolean
    isFetching: boolean
    errorMessage: string | null
    actionError: string | null
    menuOpenId: string | null
    isTogglePending: boolean
    onToggleStar: (id: string, event: React.MouseEvent) => void
    onToggleMenu: (id: string, event: React.MouseEvent) => void
    onOpenRename: (project: Project, event: React.MouseEvent) => void
    onOpenDuplicate: (project: Project, event: React.MouseEvent) => void
    onOpenDelete: (project: Project, event: React.MouseEvent) => void
}

const ProjectListAreaSkeleton: React.FC = () => {
    return (
        <div className="min-h-[420px] flex flex-col gap-1">
            {Array.from({ length: 6 }).map((_, index) => (
                <div
                    key={`project-list-skeleton-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_2.5rem_2.5rem] items-center gap-3 rounded-xl px-5 py-4 md:gap-4"
                >
                    <div>
                        <Skeleton className="h-4 w-56 max-w-full" />
                    </div>
                    <div>
                        <Skeleton className="h-3.5 w-24" />
                    </div>
                    <div className="flex justify-center">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                    <div className="flex justify-center">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
    projects,
    onNewProject,
    isInitialLoading,
    isFetching,
    errorMessage,
    actionError,
    menuOpenId,
    isTogglePending,
    onToggleStar,
    onToggleMenu,
    onOpenRename,
    onOpenDuplicate,
    onOpenDelete,
}) => {
    const displayedError = actionError ?? errorMessage

    return (
        <>
            <div className="mb-12 flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-medium tracking-tight text-textMain">Projects</h1>
                    <p className="max-w-md text-sm leading-relaxed text-neutral-500">
                        Manage your projects
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isFetching && !isInitialLoading && (
                        <div className="text-xs text-neutral-500">Syncing projects...</div>
                    )}
                    {displayedError && (
                        <div className="max-w-[26rem] truncate rounded-full border border-red-500/35 bg-red-500/15 px-4 py-1 text-xs font-medium text-red-200">
                            {displayedError}
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto_2.5rem_2.5rem] gap-3 border-b border-white/5 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500 select-none md:gap-4">
                <div>Name</div>
                <div className="pr-2">Last Edited</div>
                <div className="text-center">Star</div>
                <div></div>
            </div>

            {isInitialLoading ? (
                <ProjectListAreaSkeleton />
            ) : (
                <div className="min-h-[420px] flex flex-col gap-1">
                    {projects.map((project) => (
                        <ProjectListRow
                            key={project.id}
                            project={project}
                            isMenuOpen={menuOpenId === project.id}
                            isTogglePending={isTogglePending}
                            onOpenProject={onNewProject}
                            onToggleStar={onToggleStar}
                            onToggleMenu={onToggleMenu}
                            onOpenRename={onOpenRename}
                            onOpenDuplicate={onOpenDuplicate}
                            onOpenDelete={onOpenDelete}
                        />
                    ))}

                    {projects.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-neutral-600">
                            <span className="text-sm">No projects found.</span>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
