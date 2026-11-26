import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { BackendSession } from '@/features/sessions/api/session'

import { useAppStore } from '@/app/store'
import { sessionAPI } from '@/features/sessions/api/session'

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

    // Helper to optimistically mutate all matching sessions queries
    const updateAllSessionsCache = (
        updater: (session: BackendSession) => BackendSession | null
    ) => {
        queryClient.setQueriesData({ queryKey: ['sessions'] }, (old: any) => {
            if (!old) return old
            if (Array.isArray(old)) {
                return old.map(updater).filter(Boolean)
            }
            if (Array.isArray(old.sessions)) {
                return {
                    ...old,
                    sessions: old.sessions.map(updater).filter(Boolean),
                }
            }
            if (Array.isArray(old.pages)) {
                return {
                    ...old,
                    pages: old.pages.map((page: any) => {
                        if (!page) return page
                        if (Array.isArray(page.sessions)) {
                            return {
                                ...page,
                                sessions: page.sessions.map(updater).filter(Boolean),
                            }
                        }
                        if (Array.isArray(page)) {
                            return page.map(updater).filter(Boolean)
                        }
                        return page
                    }),
                }
            }
            return old
        })
    }

    // Helper to optimistically mutate a singular session query
    const updateSingleSessionCache = (sessionId: string, updater: (session: any) => any) => {
        queryClient.setQueryData(['session', sessionId], (old: any) => {
            if (!old) return old
            return updater(old)
        })
    }

    const invalidateAllSessionQueries = (sessionId?: string) => {
        queryClient.invalidateQueries({ queryKey: ['sessions'] })
        if (sessionId) {
            queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
        }
    }

    const toggleArchiveMutation = useMutation({
        mutationFn: ({
            sessionId,
            isArchived,
            restorePinnedAt,
        }: {
            sessionId: string
            isArchived: boolean
            /** an undo of an archive: the pin the archive removed comes back */
            restorePinnedAt?: string | null
        }): Promise<unknown> => {
            if (isArchived) return sessionAPI.archiveSession(sessionId)
            if (restorePinnedAt) {
                return sessionAPI.unarchiveSessions(
                    [sessionId],
                    [{ sessionId, pinnedAt: restorePinnedAt }]
                )
            }
            return sessionAPI.unarchiveSession(sessionId)
        },
        onMutate: async ({ sessionId, isArchived, restorePinnedAt }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: ['sessions'] })
            await queryClient.cancelQueries({ queryKey: ['session', sessionId] })

            // archive removes the pin on the server
            updateAllSessionsCache((session) =>
                session.id === sessionId
                    ? {
                          ...session,
                          isArchived,
                          isPinned: isArchived ? false : Boolean(restorePinnedAt),
                          pinnedAt: isArchived ? null : (restorePinnedAt ?? null),
                      }
                    : session
            )
            updateSingleSessionCache(sessionId, (session) => ({ ...session, isArchived }))
        },
        onError: (error) => {
            setActionError(getErrorMessage(error, 'Failed to update session archive status'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: (_data, _error, variables) => {
            invalidateAllSessionQueries(variables?.sessionId)
        },
    })

    const togglePinMutation = useMutation({
        mutationFn: ({ sessionId, isPinned }: { sessionId: string; isPinned: boolean }) =>
            isPinned ? sessionAPI.pinSession(sessionId) : sessionAPI.unpinSession(sessionId),
        onMutate: async ({ sessionId, isPinned }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: ['sessions'] })
            updateAllSessionsCache((session) =>
                session.id === sessionId
                    ? { ...session, isPinned, pinnedAt: isPinned ? new Date().toISOString() : null }
                    : session
            )
        },
        onError: (error) => {
            setActionError(getErrorMessage(error, 'Failed to pin session'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        // the server puts pinned sessions first, so read the list again
        onSettled: (_data, _error, variables) => {
            invalidateAllSessionQueries(variables?.sessionId)
        },
    })

    const renameMutation = useMutation({
        mutationFn: ({ sessionId, rename }: { sessionId: string; rename: string }) =>
            sessionAPI.renameSession(sessionId, rename),
        onMutate: async ({ sessionId, rename }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: ['sessions'] })
            await queryClient.cancelQueries({ queryKey: ['session', sessionId] })

            // Optimistically update sessions collection cache
            updateAllSessionsCache((session) =>
                session.id === sessionId ? { ...session, title: rename } : session
            )
            // Optimistically update single session query
            updateSingleSessionCache(sessionId, (session) => ({ ...session, title: rename }))

            // Optimistically update Zustand store if active
            const activeId = useAppStore.getState().activeProjectId
            if (activeId === sessionId) {
                useAppStore.getState().setActiveProjectName(rename)
            }

            onRenameMutate()
        },
        onError: (error) => {
            setActionError(getErrorMessage(error, 'Failed to rename session'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: (_data, _error, variables) => {
            invalidateAllSessionQueries(variables?.sessionId)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (sessionId: string) => sessionAPI.deleteSession(sessionId),
        onMutate: async (sessionId) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: ['sessions'] })
            await queryClient.cancelQueries({ queryKey: ['session', sessionId] })

            updateAllSessionsCache((session) => (session.id === sessionId ? null : session))
            queryClient.removeQueries({ queryKey: ['session', sessionId] })

            onDeleteMutate()
        },
        onError: (error) => {
            setActionError(getErrorMessage(error, 'Failed to delete session'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            invalidateAllSessionQueries()
        },
    })

    const updateTagsMutation = useMutation({
        mutationFn: ({ sessionId, tags }: { sessionId: string; tags: string[] }) =>
            sessionAPI.updateSessionTags(sessionId, tags),
        onMutate: async ({ sessionId, tags }) => {
            setActionError(null)
            await queryClient.cancelQueries({ queryKey: ['sessions'] })
            await queryClient.cancelQueries({ queryKey: ['session', sessionId] })

            updateAllSessionsCache((session) =>
                session.id === sessionId ? { ...session, tags } : session
            )
            updateSingleSessionCache(sessionId, (session) => ({ ...session, tags }))
        },
        onError: (error) => {
            setActionError(getErrorMessage(error, 'Failed to update tags'))
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: (_data, _error, variables) => {
            invalidateAllSessionQueries(variables?.sessionId)
        },
    })

    return {
        toggleArchiveMutation,
        togglePinMutation,
        renameMutation,
        deleteMutation,
        updateTagsMutation,
    }
}
