import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'

import { GC_PRESETS, initQueryCachePersistence } from '../lib/query-cache'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minute default stale time eliminates thrashing on tab switch
            gcTime: GC_PRESETS.STANDARD, // 15 minutes in-memory garbage collection time
            refetchOnWindowFocus: true,
            retry: 1,
        },
    },
})

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
        const unsubscribe = initQueryCachePersistence(queryClient)
        return () => {
            unsubscribe()
        }
    }, [])

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
