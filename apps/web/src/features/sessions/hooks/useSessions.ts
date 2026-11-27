import { keepPreviousData, useQuery, useInfiniteQuery } from '@tanstack/react-query'

import { sessionAPI, type SessionFilters } from '../api/session'

import { useAppStore } from '@/app/store'

// a run that ends is not pushed to the list: while a row works, the list reads again
const RUNNING_REFRESH_MS = 5000
const isWorking = (vmStatus?: string | null) =>
    vmStatus === 'RUNNING' || vmStatus === 'PROVISIONING'

export const useSessions = (
    filters?: SessionFilters,
    options?: {
        enabled?: boolean
        /** read the list again every 5 s while one of its rows runs or starts */
        refreshWhileWorking?: boolean
    }
) => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: ['sessions', filters],
        queryFn: () => sessionAPI.getSessions(filters),
        enabled: isAuthenticated && (options?.enabled ?? true),
        placeholderData: (previousData) => previousData,
        refetchInterval: options?.refreshWhileWorking
            ? (query) =>
                  query.state.data?.sessions?.some((session) => isWorking(session.vmStatus))
                      ? RUNNING_REFRESH_MS
                      : false
            : undefined,
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
        // a stopped or finished run leaves "Running" within a few seconds
        refetchInterval: (query) =>
            query.state.data?.pages.some((page) =>
                page.sessions.some((session) => isWorking(session.vmStatus))
            )
                ? RUNNING_REFRESH_MS
                : false,
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
        refetchInterval: (query) =>
            (query.state.data?.running ?? 0) > 0 ? RUNNING_REFRESH_MS : false,
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
