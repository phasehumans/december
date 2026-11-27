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
        // the first page by number, the next ones after the cursor of the page before: a
        // row that moves while the user scrolls is not shown twice or skipped
        queryFn: ({ pageParam }) =>
            sessionAPI.getPullRequests({
                ...params,
                ...(pageParam ? { cursor: pageParam } : { page: 1 }),
                limit: PULL_REQUESTS_PAGE_SIZE,
            }),
        getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
        initialPageParam: null as string | null,
        enabled: isAuthenticated,
        // a new sort, filter or search keeps the current rows on screen until its rows
        // arrive, instead of dropping to the loading rows
        placeholderData: keepPreviousData,
    })
}
