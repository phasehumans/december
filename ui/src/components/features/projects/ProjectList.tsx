import React, { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Icons } from '../../ui/Icons'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Skeleton } from '../../ui/Skeleton'
import type { Project } from '../../../types'
import { projectAPI } from '@/api/project'

interface ProjectListProps {
    onNewProject: () => void
    projects: Project[]
    isLoading: boolean
    isFetching: boolean
    errorMessage: string | null
}

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
        <div className="space-y-6 min-h-[520px]">
            <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-44" />
            </div>

            <div className="flex flex-col gap-2 min-h-[420px]">
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
    const queryClient = useQueryClient()
    const projectQueryKey = ['projects'] as const
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

    // Modal States
    const [renameModal, setRenameModal] = useState<{
        isOpen: boolean
        project: Project | null
        value: string
    }>({
        isOpen: false,
        project: null,
        value: '',
    })
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; project: Project | null }>({
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

    const toggleStarMutation = useMutation({
        mutationFn: ({ projectId, isStarred }: { projectId: string; isStarred: boolean }) =>
            projectAPI.updateProject(projectId, { isStarred }),
        onMutate: async ({ projectId, isStarred }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: projectQueryKey })

            const previousProjects = queryClient.getQueryData<Project[]>(projectQueryKey)

            queryClient.setQueryData<Project[]>(projectQueryKey, (currentProjects = []) =>
                currentProjects.map((project) =>
                    project.id === projectId ? { ...project, isStarred } : project
                )
            )

            return { previousProjects }
        },
        onError: (error, _variables, context) => {
            if (context?.previousProjects) {
                queryClient.setQueryData(projectQueryKey, context.previousProjects)
            }
            setActionError(error instanceof Error ? error.message : 'Failed to update project')
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: projectQueryKey })
        },
    })

    const renameMutation = useMutation({
        mutationFn: ({ projectId, rename }: { projectId: string; rename: string }) =>
            projectAPI.updateProject(projectId, { rename }),
        onMutate: async ({ projectId, rename }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: projectQueryKey })

            const previousProjects = queryClient.getQueryData<Project[]>(projectQueryKey)

            queryClient.setQueryData<Project[]>(projectQueryKey, (currentProjects = []) =>
                currentProjects.map((project) =>
                    project.id === projectId ? { ...project, title: rename } : project
                )
            )

            setRenameModal({ isOpen: false, project: null, value: '' })

            return { previousProjects }
        },
        onError: (error, _variables, context) => {
            if (context?.previousProjects) {
                queryClient.setQueryData(projectQueryKey, context.previousProjects)
            }
            setActionError(error instanceof Error ? error.message : 'Failed to rename project')
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: projectQueryKey })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (projectId: string) => projectAPI.deleteProject(projectId),
        onMutate: async (projectId) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: projectQueryKey })

            const previousProjects = queryClient.getQueryData<Project[]>(projectQueryKey)

            queryClient.setQueryData<Project[]>(projectQueryKey, (currentProjects = []) =>
                currentProjects.filter((project) => project.id !== projectId)
            )

            setDeleteModal({ isOpen: false, project: null })

            return { previousProjects }
        },
        onError: (error, _variables, context) => {
            if (context?.previousProjects) {
                queryClient.setQueryData(projectQueryKey, context.previousProjects)
            }
            setActionError(error instanceof Error ? error.message : 'Failed to delete project')
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: projectQueryKey })
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
        <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-8 pt-20 md:p-16 w-full font-sans bg-background relative h-full">
            <div className="max-w-6xl mx-auto relative z-10 min-h-[520px]">
                {isInitialLoading ? (
                    <ProjectListSkeleton />
                ) : (
                    <>
                        <div className="flex items-end justify-between gap-4 mb-12">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-medium text-textMain tracking-tight">Projects</h1>
                        <p className="text-neutral-500 text-sm max-w-md leading-relaxed">
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

                <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[11px] font-medium text-neutral-500 uppercase tracking-wider border-b border-white/5 mb-2 select-none">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-4">Last Edited</div>
                    <div className="col-span-2 text-right"></div>
                </div>

                <div className="flex flex-col gap-1 min-h-[420px]">

                    {projects.map((project) => (
                            <div
                                key={project.id}
                                className="group grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-xl hover:bg-surface/40 border border-transparent hover:border-white/5 transition-all duration-200 cursor-pointer relative"
                                onClick={onNewProject}
                            >
                                <div className="col-span-6 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-surface border border-white/5 hidden md:flex items-center justify-center text-neutral-500 group-hover:text-white transition-colors shrink-0 shadow-sm">
                                        <Icons.Globe className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                                        <span className="text-[15px] font-medium text-textMain truncate group-hover:text-white transition-colors">
                                            {project.title}
                                        </span>
                                        <span className="text-xs text-neutral-600 truncate group-hover:text-neutral-500 transition-colors">
                                            {project.description}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-span-4 text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors font-medium">
                                    {project.updatedAt}
                                </div>
                                <div className="col-span-2 flex items-center justify-end gap-2 relative">
                                    <button
                                        onClick={(e) => toggleStar(project.id, e)}
                                        className="p-2 rounded-lg transition-all duration-200 hover:bg-white/5 focus:outline-none"
                                        title={project.isStarred ? 'Unstar' : 'Star'}
                                        disabled={toggleStarMutation.isPending}
                                    >
                                        <Icons.Star
                                            className={`w-4 h-4 transition-colors ${project.isStarred ? 'fill-white text-white' : 'text-neutral-600 hover:text-white'}`}
                                        />
                                    </button>
                                    <div
                                        className={`relative ${menuOpenId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setMenuOpenId(
                                                    menuOpenId === project.id ? null : project.id
                                                )
                                            }}
                                            className={`p-2 text-neutral-600 hover:text-white rounded-lg hover:bg-white/5 transition-all ${menuOpenId === project.id ? 'text-white bg-white/5' : ''}`}
                                        >
                                            <Icons.MoreHorizontal className="w-4 h-4" />
                                        </button>
                                        {menuOpenId === project.id && (
                                            <div
                                                className="absolute top-9 right-0 bg-[#1C1C1E] border border-white/10 rounded-lg shadow-xl z-30 w-48 py-1.5 flex flex-col ring-1 ring-black/50"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setRenameModal({
                                                            isOpen: true,
                                                            project,
                                                            value: project.title,
                                                        })
                                                        setMenuOpenId(null)
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-neutral-300 hover:text-white hover:bg-white/5 text-left transition-colors mx-1 rounded-md w-full"
                                                >
                                                    <Icons.Edit className="w-3.5 h-3.5" /> Rename
                                                </button>
                                                <div className="h-px bg-white/5 my-1 mx-1" />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDeleteModal({ isOpen: true, project })
                                                        setMenuOpenId(null)
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-red-400 hover:text-red-300 hover:bg-white/5 text-left transition-colors mx-1 rounded-md w-full"
                                                >
                                                    <Icons.Trash className="w-3.5 h-3.5" /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                    {projects.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-neutral-600">
                            <span className="text-sm">No projects found.</span>
                        </div>
                    )}
                </div>
                    </>
                )}
            </div>

            <Modal
                isOpen={renameModal.isOpen}
                onClose={() => setRenameModal({ ...renameModal, isOpen: false })}
                title="Rename project"
                description="Update how this project appears in your workspace."
            >
                <form onSubmit={handleRename} className="flex flex-col gap-4">
                    <Input
                        label="Display Name"
                        autoFocus
                        value={renameModal.value}
                        onChange={(e) =>
                            setRenameModal((prev) => ({ ...prev, value: e.target.value }))
                        }
                    />
                    <div className="flex items-center justify-end gap-3 mt-4">
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => setRenameModal({ ...renameModal, isOpen: false })}
                            disabled={renameMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!renameModal.value.trim() || renameMutation.isPending}
                            isLoading={renameMutation.isPending}
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                title="Delete project?"
                maxWidth="max-w-[400px]"
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-neutral-400 leading-relaxed">
                        Are you sure you want to delete{' '}
                        <span className="text-white font-medium">"{deleteModal.project?.title}"</span>
                        ? This action cannot be undone.
                    </p>
                    <div className="flex items-center justify-end gap-3 mt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                            disabled={deleteMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            className="bg-red-600 text-white border-0 hover:bg-red-700"
                            onClick={handleDelete}
                            isLoading={deleteMutation.isPending}
                        >
                            Continue
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
