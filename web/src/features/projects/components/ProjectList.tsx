import React, { useEffect, useState } from 'react'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { useProjectListMutations } from '../hooks/useProjectListMutations'
import type {
    ProjectListProps,
    RenameModalState,
    DeleteModalState,
    Project,
} from '@/features/projects/types'
import { ProjectListRow } from './ProjectListRow'
import { ProjectRenameModal } from './ProjectRenameModal'
import { ProjectDeleteModal } from './ProjectDeleteModal'

const ProjectRowSkeleton = () => {
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

const ProjectListSkeleton = () => {
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

export const ProjectList: React.FC<ProjectListProps> = ({
    onNewProject,
    projects,
    isLoading,
    isFetching,
    errorMessage,
}) => {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
    const [renameModal, setRenameModal] = useState<RenameModalState>({
        isOpen: false,
        project: null,
        value: '',
    })
    const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
        isOpen: false,
        project: null,
    })
    const [actionError, setActionError] = useState<string | null>(null)
    const isInitialLoading = isLoading && projects.length === 0

    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null)
        if (menuOpenId) window.addEventListener('click', handleClickOutside)
        return () => window.removeEventListener('click', handleClickOutside)
    }, [menuOpenId])

    const { toggleStarMutation, renameMutation, deleteMutation } = useProjectListMutations({
        setActionError,
        onRenameMutate: () => {
            setRenameModal({ isOpen: false, project: null, value: '' })
        },
        onDeleteMutate: () => {
            setDeleteModal({ isOpen: false, project: null })
        },
    })

    const toggleStar = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const project = projects.find((item) => item.id === id)

        if (!project) {
            return
        }

        toggleStarMutation.mutate({
            projectId: id,
            isStarred: !project.isStarred,
        })
    }

    const toggleMenu = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setMenuOpenId((prev) => (prev === id ? null : id))
    }

    const openRenameModal = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setRenameModal({
            isOpen: true,
            project,
            value: project.title,
        })
        setMenuOpenId(null)
    }

    const openDeleteModal = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setDeleteModal({
            isOpen: true,
            project,
        })
        setMenuOpenId(null)
    }

    const handleRename = (e: React.FormEvent) => {
        e.preventDefault()

        if (!renameModal.project || !renameModal.value.trim()) {
            return
        }

        renameMutation.mutate({
            projectId: renameModal.project.id,
            rename: renameModal.value.trim(),
        })
    }

    const handleDelete = () => {
        if (!deleteModal.project) {
            return
        }

        deleteMutation.mutate(deleteModal.project.id)
    }

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background px-8 pb-8 pt-20 font-sans no-scrollbar md:p-16">
            <div className="relative z-10 mx-auto min-h-[520px] max-w-6xl">
                {isInitialLoading ? (
                    <ProjectListSkeleton />
                ) : (
                    <>
                        <div className="mb-12 flex items-end justify-between gap-4">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-3xl font-medium tracking-tight text-textMain">
                                    Projects
                                </h1>
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
                                    isTogglePending={toggleStarMutation.isPending}
                                    onOpenProject={onNewProject}
                                    onToggleStar={toggleStar}
                                    onToggleMenu={toggleMenu}
                                    onOpenRename={openRenameModal}
                                    onOpenDelete={openDeleteModal}
                                />
                            ))}

                            {projects.length === 0 && (
                                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-neutral-600">
                                    <span className="text-sm">No projects found.</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <ProjectRenameModal
                isOpen={renameModal.isOpen}
                value={renameModal.value}
                isPending={renameMutation.isPending}
                onClose={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
                onChange={(nextValue) => setRenameModal((prev) => ({ ...prev, value: nextValue }))}
                onSubmit={handleRename}
            />

            <ProjectDeleteModal
                isOpen={deleteModal.isOpen}
                projectTitle={deleteModal.project?.title}
                isPending={deleteMutation.isPending}
                onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                onConfirm={handleDelete}
            />
        </div>
    )
}
