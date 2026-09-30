import { describe, it, expect, beforeEach } from 'bun:test'

import { appCache } from '../../src/shared/cache'

describe('AppCache - Unit Tests', () => {
    beforeEach(() => {
        appCache.clear()
    })

    it('should generate consistent namespaced cache keys', () => {
        const key = appCache.key('profile', 'user-123')
        expect(key).toBe('cache:profile:user-123')
    })

    it('should store and retrieve data from cache', async () => {
        const key = appCache.key('test', '1')
        const payload = { id: 1, name: 'december', active: true }

        await appCache.set(key, payload, 60)
        const cached = await appCache.get<typeof payload>(key)

        expect(cached).toEqual(payload)
    })

    it('should return null for expired or missing keys', async () => {
        const key = appCache.key('test', 'expired')
        // set with 0 second TTL (immediately expired)
        await appCache.set(key, { data: 'old' }, -1)

        const cached = await appCache.get(key)
        expect(cached).toBeNull()
    })

    it('should delete a specific key', async () => {
        const key = appCache.key('test', 'delete-me')
        await appCache.set(key, { message: 'hello' }, 60)

        await appCache.del(key)
        const cached = await appCache.get(key)

        expect(cached).toBeNull()
    })

    it('should delete keys matching a pattern', async () => {
        const key1 = appCache.key('user', 'u1', 'profile')
        const key2 = appCache.key('user', 'u1', 'settings')
        const key3 = appCache.key('user', 'u2', 'profile')

        await appCache.set(key1, { name: 'User 1' }, 60)
        await appCache.set(key2, { theme: 'dark' }, 60)
        await appCache.set(key3, { name: 'User 2' }, 60)

        await appCache.delPattern('cache:user:u1:*')

        expect(await appCache.get(key1)).toBeNull()
        expect(await appCache.get(key2)).toBeNull()
        expect(await appCache.get(key3)).not.toBeNull()
    })

    it('should wrap a function call with cache-aside behavior', async () => {
        const key = appCache.key('computed', 'val')
        let fetchCount = 0

        const fetcher = async () => {
            fetchCount++
            return { count: fetchCount }
        }

        const result1 = await appCache.wrap(key, 60, fetcher)
        expect(result1).toEqual({ count: 1 })
        expect(fetchCount).toBe(1)

        // second call should return cached value without executing fetcher
        const result2 = await appCache.wrap(key, 60, fetcher)
        expect(result2).toEqual({ count: 1 })
        expect(fetchCount).toBe(1)

        // after deleting key, fetcher should execute again
        await appCache.del(key)
        const result3 = await appCache.wrap(key, 60, fetcher)
        expect(result3).toEqual({ count: 2 })
        expect(fetchCount).toBe(2)
    })
})
