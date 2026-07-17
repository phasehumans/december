import { useQuery } from '@tanstack/react-query'

import { sessionAPI, type SessionFilters } from '../api/session'

import { useAppStore } from '@/app/store'

export const useSessions = (filters?: SessionFilters) => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: ['sessions', filters],
        queryFn: () => sessionAPI.getSessions(filters),
        enabled: isAuthenticated,
        placeholderData: (previousData) => previousData,
    })
}
