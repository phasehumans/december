import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'

import type { PullRequestsViewParams } from '@/features/pullrequests/lib/pullRequestsView'

import { useAppStore } from '@/app/store'
import { sessionAPI } from '@/features/sessions/api/session'

/** rows of one request. more load on scroll, like the Sessions page */
export const PULL_REQUESTS_PAGE_SIZE = 30

/**
 * the pull requests list, filtered, sorted and paged by the server. under ['sessions'],
 * so every list write reads the rows again
 */
export const useInfinitePullRequests = (params: PullRequestsViewParams) => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)

    return useInfiniteQuery({
        queryKey: ['sessions', 'pull-requests', params],
        queryFn: ({ pageParam = 1 }) =>
            sessionAPI.getPullRequests({
                ...params,
                page: pageParam,
                limit: PULL_REQUESTS_PAGE_SIZE,
            }),
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pagination
            return page < totalPages ? page + 1 : undefined
        },
        initialPageParam: 1,
        enabled: isAuthenticated,
        // a new sort, filter or search keeps the current rows on screen until its rows
        // arrive, instead of dropping to the loading rows
        placeholderData: keepPreviousData,
    })
}
