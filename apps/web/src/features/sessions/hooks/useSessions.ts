import { keepPreviousData, useQuery, useInfiniteQuery } from '@tanstack/react-query'

import { sessionAPI, type SessionFilters } from '../api/session'

import { useAppStore } from '@/app/store'

export const useSessions = (filters?: SessionFilters, options?: { enabled?: boolean }) => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: ['sessions', filters],
        queryFn: () => sessionAPI.getSessions(filters),
        enabled: isAuthenticated && (options?.enabled ?? true),
        placeholderData: (previousData) => previousData,
    })
}

export const useInfiniteSessions = (filters?: SessionFilters) => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)

    return useInfiniteQuery({
        queryKey: ['sessions', 'infinite', filters],
        queryFn: ({ pageParam = 1 }) =>
            sessionAPI.getSessions({ ...filters, page: pageParam, limit: filters?.limit || 30 }),
        getNextPageParam: (lastPage) => {
            const pagination = lastPage.pagination
            if (!pagination) return undefined
            const { page, totalPages } = pagination
            return page < totalPages ? page + 1 : undefined
        },
        initialPageParam: 1,
        enabled: isAuthenticated,
        // a new sort, filter or search keeps the current rows on screen until its rows
        // arrive, instead of dropping to the loading skeleton
        placeholderData: keepPreviousData,
    })
}

/**
 * the counts beside the toolbar switches (Running, Open), from the server, so they cover
 * every session and not only the loaded rows. under ['sessions'], so every list write
 * reads them again
 */
export const useSessionCounts = () => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: ['sessions', 'counts'],
        queryFn: () => sessionAPI.getSessionCounts(),
        enabled: isAuthenticated,
    })
}

/**
 * every repository and tag of the user, for the Repository and Tag lists of a sort and
 * filter menu. hasPr keeps only those of sessions that opened a pull request
 */
export const useSessionFacets = (options?: { hasPr?: boolean }) => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)
    const hasPr = options?.hasPr ?? false

    return useQuery({
        queryKey: ['sessions', 'facets', hasPr ? 'pull-requests' : 'all'],
        queryFn: () => sessionAPI.getSessionFacets({ hasPr }),
        enabled: isAuthenticated,
    })
}
