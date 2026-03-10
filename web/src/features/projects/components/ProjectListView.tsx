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
    onOpenDelete: (project: Project, event: React.MouseEvent) => void
}

const ProjectRowSkeleton: React.FC = () => {
    return (
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-surface/20 px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="ml-4 h-3 w-24 shrink-0" />
        </div>
    )
}

const ProjectListSkeleton: React.FC = () => {
    return (
        <div className="min-h-[520px] space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-44" />
            </div>

            <div className="min-h-[420px] flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <ProjectRowSkeleton key={`project-list-skeleton-${index}`} />
                ))}
            </div>
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
    onOpenDelete,
}) => {
    if (isInitialLoading) {
        return <ProjectListSkeleton />
    }

    return (
        <>
            <div className="mb-12 flex items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-medium tracking-tight text-textMain">Projects</h1>
                    <p className="max-w-md text-sm leading-relaxed text-neutral-500">
                        Manage your projects
                    </p>
                </div>
                {isFetching && !isInitialLoading && (
                    <div className="text-xs text-neutral-500">Syncing projects...</div>
                )}
            </div>

            {(errorMessage || actionError) && (
                <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                    {actionError ?? errorMessage}
                </div>
            )}

            <div className="mb-2 grid grid-cols-12 gap-4 border-b border-white/5 px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500 select-none">
                <div className="col-span-6">Name</div>
                <div className="col-span-4">Last Edited</div>
                <div className="col-span-2 text-right"></div>
            </div>

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
                        onOpenDelete={onOpenDelete}
                    />
                ))}

                {projects.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-neutral-600">
                        <span className="text-sm">No projects found.</span>
                    </div>
                )}
            </div>
        </>
    )
}
