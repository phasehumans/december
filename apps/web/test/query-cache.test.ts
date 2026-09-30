import { QueryClient } from '@tanstack/react-query'
import { describe, it, expect, beforeEach } from 'bun:test'

import {
    CACHE_PRESETS,
    GC_PRESETS,
    persistQueryCache,
    restoreQueryCache,
    clearPersistedQueryCache,
    initQueryCachePersistence,
} from '../src/shared/lib/query-cache'

describe('Client-Side Query Cache - Unit Tests', () => {
    let mockStorage: Record<string, string> = {}

    beforeEach(() => {
        mockStorage = {}
        const storageObj = {
            getItem: (key: string) => mockStorage[key] ?? null,
            setItem: (key: string, value: string) => {
                mockStorage[key] = value
            },
            removeItem: (key: string) => {
                delete mockStorage[key]
            },
            clear: () => {
                mockStorage = {}
            },
            key: (_i: number) => null,
            length: 0,
        } as Storage
        try {
            Object.defineProperty(globalThis, 'localStorage', {
                value: storageObj,
                writable: true,
                configurable: true,
            })
        } catch {
            // fallback
        }
        if (typeof window !== 'undefined') {
            try {
                Object.defineProperty(window, 'localStorage', {
                    value: storageObj,
                    writable: true,
                    configurable: true,
                })
            } catch {
                // Ignore if read-only
            }
        }
    })

    it('should have standard cache presets defined', () => {
        expect(CACHE_PRESETS.STATIC).toBeGreaterThanOrEqual(5 * 60 * 1000)
        expect(CACHE_PRESETS.SEMI_STATIC).toBeGreaterThan(0)
        expect(CACHE_PRESETS.DYNAMIC).toBe(30 * 1000)
        expect(CACHE_PRESETS.REALTIME).toBe(0)
        expect(GC_PRESETS.STANDARD).toBeGreaterThanOrEqual(10 * 60 * 1000)
    })

    it('should persist whitelisted queries and skip non-whitelisted ones', () => {
        const queryClient = new QueryClient()

        queryClient.setQueryData(['profile'], { id: 'u1', name: 'Alice' })
        queryClient.setQueryData(['settings'], { theme: 'dark' })
        queryClient.setQueryData(['realtime-stream'], { token: 'xyz' })

        persistQueryCache(queryClient, 'test_cache', ['profile', 'settings'])

        const raw = mockStorage['test_cache']
        expect(raw).toBeDefined()
        const parsed = JSON.parse(raw!)

        expect(parsed.queries).toBeDefined()
        // Should contain profile and settings, but NOT realtime-stream
        const keys = parsed.queries.map((q: any) => q.queryKey[0])
        expect(keys).toContain('profile')
        expect(keys).toContain('settings')
        expect(keys).not.toContain('realtime-stream')
    })

    it('should restore persisted queries into a new QueryClient', () => {
        const queryClient1 = new QueryClient()
        queryClient1.setQueryData(['profile'], { id: 'u1', name: 'Alice' })
        persistQueryCache(queryClient1, 'test_cache', ['profile'])

        const queryClient2 = new QueryClient()
        expect(queryClient2.getQueryData(['profile'])).toBeUndefined()

        const restored = restoreQueryCache(queryClient2, 'test_cache')
        expect(restored).toBe(true)
        expect(queryClient2.getQueryData<any>(['profile'])).toEqual({ id: 'u1', name: 'Alice' })
    })

    it('should ignore expired persisted cache', () => {
        const payload = {
            timestamp: Date.now() - 100000,
            queries: [
                { queryKey: ['profile'], state: { data: { name: 'Old' }, status: 'success' } },
            ],
        }
        mockStorage['test_cache'] = JSON.stringify(payload)

        const queryClient = new QueryClient()
        // Max age: 1000ms (1s), so 100s old is expired
        const restored = restoreQueryCache(queryClient, 'test_cache', 1000)

        expect(restored).toBe(false)
        expect(queryClient.getQueryData(['profile'])).toBeUndefined()
    })

    it('should clear persisted cache on demand', () => {
        mockStorage['test_cache'] = JSON.stringify({ queries: [] })
        clearPersistedQueryCache('test_cache')
        expect(mockStorage['test_cache']).toBeUndefined()
    })

    it('should initialize persistence and return an unsubscribe function', () => {
        const queryClient = new QueryClient()
        const unsubscribe = initQueryCachePersistence(queryClient, 'test_cache', ['profile'])

        expect(typeof unsubscribe).toBe('function')
        unsubscribe()
    })
})
