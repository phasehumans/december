import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { BackendSession } from '@/features/sessions/api/session'
import { sessionAPI } from '@/features/sessions/api/session'

const sessionQueryKey = ['sessions'] as const

type UseSessionListMutationsOptions = {
    setActionError: (message: string | null) => void
    onRenameMutate: () => void
    onDeleteMutate: () => void
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
        return error.message
    }
    return fallback
}

export const useSessionListMutations = ({
    setActionError,
    onRenameMutate,
    onDeleteMutate,
}: UseSessionListMutationsOptions) => {
    const queryClient = useQueryClient()

    const togglePinMutation = useMutation({
        mutationFn: ({ sessionId, isPinned }: { sessionId: string; isPinned: boolean }) =>
            sessionAPI.updateSessionSettings(sessionId, { isPinned }),
        onMutate: async ({ sessionId, isPinned }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: sessionQueryKey })

            const previousSessions = queryClient.getQueryData<BackendSession[]>(sessionQueryKey)

            queryClient.setQueryData<BackendSession[]>(sessionQueryKey, (currentSessions = []) =>
                currentSessions.map((session) =>
                    session.id === sessionId ? { ...session, isPinned } : session
                )
            )

            return { previousSessions }
        },
        onError: (error, _variables, context) => {
            if (context?.previousSessions) {
                queryClient.setQueryData(sessionQueryKey, context.previousSessions)
            }
            setActionError(getErrorMessage(error, 'Failed to update session pin status'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKey })
        },
    })

    const toggleArchiveMutation = useMutation({
        mutationFn: ({ sessionId, isArchived }: { sessionId: string; isArchived: boolean }) =>
            isArchived
                ? sessionAPI.archiveSession(sessionId)
                : sessionAPI.unarchiveSession(sessionId),
        onMutate: async ({ sessionId, isArchived }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: sessionQueryKey })

            const previousSessions = queryClient.getQueryData<BackendSession[]>(sessionQueryKey)

            queryClient.setQueryData<BackendSession[]>(sessionQueryKey, (currentSessions = []) =>
                currentSessions.map((session) =>
                    session.id === sessionId ? { ...session, isArchived } : session
                )
            )

            return { previousSessions }
        },
        onError: (error, _variables, context) => {
            if (context?.previousSessions) {
                queryClient.setQueryData(sessionQueryKey, context.previousSessions)
            }
            setActionError(getErrorMessage(error, 'Failed to update session archive status'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKey })
        },
    })

    const renameMutation = useMutation({
        mutationFn: ({ sessionId, rename }: { sessionId: string; rename: string }) =>
            sessionAPI.renameSession(sessionId, rename),
        onMutate: async ({ sessionId, rename }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: sessionQueryKey })

            const previousSessions = queryClient.getQueryData<BackendSession[]>(sessionQueryKey)

            queryClient.setQueryData<BackendSession[]>(sessionQueryKey, (currentSessions = []) =>
                currentSessions.map((session) =>
                    session.id === sessionId ? { ...session, title: rename } : session
                )
            )

            onRenameMutate()

            return { previousSessions }
        },
        onError: (error, _variables, context) => {
            if (context?.previousSessions) {
                queryClient.setQueryData(sessionQueryKey, context.previousSessions)
            }
            setActionError(getErrorMessage(error, 'Failed to rename session'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKey })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (sessionId: string) => sessionAPI.deleteSession(sessionId),
        onMutate: async (sessionId) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: sessionQueryKey })

            const previousSessions = queryClient.getQueryData<BackendSession[]>(sessionQueryKey)

            queryClient.setQueryData<BackendSession[]>(sessionQueryKey, (currentSessions = []) =>
                currentSessions.filter((session) => session.id !== sessionId)
            )

            onDeleteMutate()

            return { previousSessions }
        },
        onError: (error, _variables, context) => {
            if (context?.previousSessions) {
                queryClient.setQueryData(sessionQueryKey, context.previousSessions)
            }
            setActionError(getErrorMessage(error, 'Failed to delete session'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKey })
        },
    })

    const updateTagsMutation = useMutation({
        mutationFn: ({ sessionId, tags }: { sessionId: string; tags: string[] }) =>
            sessionAPI.updateSessionTags(sessionId, tags),
        onMutate: async ({ sessionId, tags }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: sessionQueryKey })

            const previousSessions = queryClient.getQueryData<BackendSession[]>(sessionQueryKey)

            queryClient.setQueryData<BackendSession[]>(sessionQueryKey, (currentSessions = []) =>
                currentSessions.map((session) =>
                    session.id === sessionId ? { ...session, tags } : session
                )
            )

            return { previousSessions }
        },
        onError: (error, _variables, context) => {
            if (context?.previousSessions) {
                queryClient.setQueryData(sessionQueryKey, context.previousSessions)
            }
            setActionError(getErrorMessage(error, 'Failed to update tags'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKey })
        },
    })

    return {
        togglePinMutation,
        toggleArchiveMutation,
        renameMutation,
        deleteMutation,
        updateTagsMutation,
    }
}
