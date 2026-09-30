import { dehydrate, hydrate } from '@tanstack/react-query'

import type { QueryClient } from '@tanstack/react-query'

/**
 * Standardized stale times across the client application.
 */
export const CACHE_PRESETS = {
    STATIC: 10 * 60 * 1000, // 10 minutes: user profile, settings, integration statuses
    SEMI_STATIC: 2 * 60 * 1000, // 2 minutes: repo lists, plans, model configs
    DYNAMIC: 30 * 1000, // 30 seconds: session listings, notification counts
    REALTIME: 0, // 0 seconds: active chat stream, live diffs
} as const

/**
 * Standardized garbage collection (cache hold) times.
 */
export const GC_PRESETS = {
    LONG: 60 * 60 * 1000, // 1 hour: static configurations
    STANDARD: 15 * 60 * 1000, // 15 minutes: general entities
    SHORT: 5 * 60 * 1000, // 5 minutes: transient list results
} as const

export const DEFAULT_PERSIST_KEY = 'december_query_cache'

export const DEFAULT_PERSIST_WHITELIST = [
    'profile',
    'settings',
    'user-info',
    'repositories',
    'billing-plans',
]

interface PersistedCachePayload {
    timestamp: number
    queries: any[]
    mutations: any[]
}

const getStorage = (): Storage | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        return (globalThis as any).localStorage
    }
    return null
}

/**
 * Persists whitelisted successful queries to browser localStorage using TanStack Query dehydrate.
 */
export const persistQueryCache = (
    queryClient: QueryClient,
    storageKey = DEFAULT_PERSIST_KEY,
    whitelist = DEFAULT_PERSIST_WHITELIST
): void => {
    const storage = getStorage()
    if (!storage) {
        return
    }

    try {
        const dehydrated = dehydrate(queryClient, {
            shouldDehydrateQuery: (query) => {
                if (query.state.status !== 'success') {
                    return false
                }
                const firstPart = query.queryKey[0]
                return typeof firstPart === 'string' && whitelist.includes(firstPart)
            },
        })

        const payload: PersistedCachePayload = {
            timestamp: Date.now(),
            queries: dehydrated.queries,
            mutations: dehydrated.mutations,
        }

        storage.setItem(storageKey, JSON.stringify(payload))
    } catch {
        // Intentionally swallowed: quota exceeded or private browsing storage access denial
    }
}

/**
 * Hydrates previously persisted queries into the provided QueryClient instance.
 */
export const restoreQueryCache = (
    queryClient: QueryClient,
    storageKey = DEFAULT_PERSIST_KEY,
    maxAgeMs = 24 * 60 * 60 * 1000
): boolean => {
    const storage = getStorage()
    if (!storage) {
        return false
    }

    try {
        const raw = storage.getItem(storageKey)
        if (!raw) {
            return false
        }

        const parsed = JSON.parse(raw) as PersistedCachePayload
        if (!parsed || !parsed.timestamp || !Array.isArray(parsed.queries)) {
            storage.removeItem(storageKey)
            return false
        }

        // Expire persisted cache older than maxAgeMs
        if (Date.now() - parsed.timestamp > maxAgeMs) {
            storage.removeItem(storageKey)
            return false
        }

        hydrate(queryClient, {
            queries: parsed.queries,
            mutations: parsed.mutations || [],
        })

        return true
    } catch {
        // Intentionally swallowed: corrupted localStorage entry removed safely
        try {
            storage.removeItem(storageKey)
        } catch {
            // Intentionally swallowed: localStorage access blocked
        }
        return false
    }
}

/**
 * Purges persisted cache from localStorage (e.g. on user sign out).
 */
export const clearPersistedQueryCache = (storageKey = DEFAULT_PERSIST_KEY): void => {
    const storage = getStorage()
    if (!storage) {
        return
    }

    try {
        storage.removeItem(storageKey)
    } catch {
        // Intentionally swallowed: storage access error
    }
}

/**
 * Initializes query cache persistence with debounced sync on query updates.
 */
export const initQueryCachePersistence = (
    queryClient: QueryClient,
    storageKey = DEFAULT_PERSIST_KEY,
    whitelist = DEFAULT_PERSIST_WHITELIST
): (() => void) => {
    // 1. Hydrate saved cache immediately
    restoreQueryCache(queryClient, storageKey)

    // 2. Debounce persistence writes
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.query.state.status === 'success') {
            const firstPart = event.query.queryKey[0]
            if (typeof firstPart === 'string' && whitelist.includes(firstPart)) {
                if (debounceTimer) {
                    clearTimeout(debounceTimer)
                }
                debounceTimer = setTimeout(() => {
                    persistQueryCache(queryClient, storageKey, whitelist)
                }, 1000)
            }
        }
    })

    return () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer)
        }
        unsubscribe()
    }
}
