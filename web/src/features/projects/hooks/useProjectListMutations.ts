import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectAPI } from '@/features/projects/api/project'
import type { Project } from '@/features/projects/types'

const projectQueryKey = ['projects'] as const

type UseProjectListMutationsOptions = {
    setActionError: (message: string | null) => void
    onRenameMutate: () => void
    onDuplicateMutate: () => void
    onShareMutate: () => void
    onDeleteMutate: () => void
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
        return error.message
    }

    return fallback
}

export const useProjectListMutations = ({
    setActionError,
    onRenameMutate,
    onDuplicateMutate,
    onShareMutate,
    onDeleteMutate,
}: UseProjectListMutationsOptions) => {
    const queryClient = useQueryClient()

    const toggleStarMutation = useMutation({
        mutationFn: ({ projectId, isStarred }: { projectId: string; isStarred: boolean }) =>
            projectAPI.toggleStarProject(projectId, isStarred),
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

            setActionError(getErrorMessage(error, 'Failed to update project'))
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

            onRenameMutate()

            return { previousProjects }
        },
        onError: (error, _variables, context) => {
            if (context?.previousProjects) {
                queryClient.setQueryData(projectQueryKey, context.previousProjects)
            }

            setActionError(getErrorMessage(error, 'Failed to rename project'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: projectQueryKey })
        },
    })

    const duplicateMutation = useMutation({
        mutationFn: (projectId: string) => projectAPI.duplicateProject(projectId),
        onMutate: async () => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: projectQueryKey })
            onDuplicateMutate()
        },
        onError: (error) => {
            setActionError(getErrorMessage(error, 'Failed to duplicate project'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: projectQueryKey })
        },
    })

    const shareMutation = useMutation({
        mutationFn: ({
            projectId,
            isSharedAsTemplate,
        }: {
            projectId: string
            isSharedAsTemplate: boolean
        }) => projectAPI.shareProjectAsTemplate(projectId, isSharedAsTemplate),
        onMutate: async () => {
            setActionError(null)
            onShareMutate()
        },
        onError: (error) => {
            setActionError(getErrorMessage(error, 'Failed to share project as template'))
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

            onDeleteMutate()

            return { previousProjects }
        },
        onError: (error, _variables, context) => {
            if (context?.previousProjects) {
                queryClient.setQueryData(projectQueryKey, context.previousProjects)
            }

            setActionError(getErrorMessage(error, 'Failed to delete project'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: projectQueryKey })
        },
    })

    return {
        toggleStarMutation,
        renameMutation,
        duplicateMutation,
        shareMutation,
        deleteMutation,
    }
}
