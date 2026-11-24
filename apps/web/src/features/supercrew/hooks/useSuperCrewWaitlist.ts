import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { waitlistAPI, type WaitlistState } from '../api/waitlist'

const QUERY_KEY = ['waitlist', 'super-crew'] as const

export const useSuperCrewWaitlist = (enabled: boolean) => {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: QUERY_KEY,
        queryFn: () => waitlistAPI.getState('super-crew'),
        enabled,
        staleTime: 5 * 60 * 1000,
    })

    const setState = (next: WaitlistState) => queryClient.setQueryData(QUERY_KEY, next)

    const join = useMutation({
        mutationFn: () => waitlistAPI.join('super-crew'),
        onSuccess: setState,
    })

    const markSeen = useMutation({
        mutationFn: () => waitlistAPI.markSeen('super-crew'),
        onSuccess: setState,
    })

    return { state: query.data, isLoading: query.isLoading, join, markSeen }
}
