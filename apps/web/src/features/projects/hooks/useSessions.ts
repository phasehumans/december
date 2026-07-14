import { useQuery } from '@tanstack/react-query'

import { sessionAPI } from '../api/session'

import { useAppStore } from '@/app/store'

export const useSessions = () => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: ['sessions'],
        queryFn: sessionAPI.getSessions,
        enabled: isAuthenticated,
        placeholderData: (previousData) => previousData,
    })
}
