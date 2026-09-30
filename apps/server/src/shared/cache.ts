import { redisClient } from '../config/redis'

interface MemoryCacheEntry {
    data: string
    expiresAt: number
}

class AppCache {
    private memoryMap = new Map<string, MemoryCacheEntry>()

    /**
     * Generate a namespaced cache key.
     */
    key(namespace: string, ...parts: string[]): string {
        const segments = [namespace, ...parts].filter(Boolean)
        return `cache:${segments.join(':')}`
    }

    /**
     * Get a value from L1 memory or L2 Redis cache.
     */
    async get<T>(key: string): Promise<T | null> {
        // 1. Check L1 in-memory cache
        const memEntry = this.memoryMap.get(key)
        if (memEntry) {
            if (Date.now() <= memEntry.expiresAt) {
                try {
                    return JSON.parse(memEntry.data) as T
                } catch {
                    // Intentionally swallowed: corrupted memory entry will fall through to Redis or null
                    this.memoryMap.delete(key)
                }
            } else {
                this.memoryMap.delete(key)
            }
        }

        // 2. Check L2 Redis cache if ready
        if (redisClient && redisClient.status === 'ready') {
            try {
                const raw = await redisClient.get(key)
                if (raw !== null) {
                    const parsed = JSON.parse(raw) as T
                    const ttl = await redisClient.ttl(key)
                    const ttlMs = ttl > 0 ? ttl * 1000 : 60 * 1000
                    // Backfill L1 memory cache with remaining TTL
                    this.memoryMap.set(key, {
                        data: raw,
                        expiresAt: Date.now() + Math.min(ttlMs, 60 * 1000),
                    })
                    return parsed
                }
            } catch (err) {
                // Intentionally swallowed: fallback to null if Redis read fails
                console.error('[AppCache Redis Get Error]', err)
            }
        }

        return null
    }

    /**
     * Store a value in L1 memory and L2 Redis cache with TTL in seconds.
     */
    async set<T>(key: string, data: T, ttlSeconds = 300): Promise<void> {
        const ttlMs = ttlSeconds * 1000
        const serialized = JSON.stringify(data)

        if (ttlSeconds <= 0) {
            this.memoryMap.delete(key)
            if (redisClient && redisClient.status === 'ready') {
                try {
                    await redisClient.del(key)
                } catch (err) {
                    // Intentionally swallowed: non-fatal Redis deletion failure
                    console.error('[AppCache Redis Delete Error on expired set]', err)
                }
            }
            return
        }

        // 1. Set L1 memory cache
        this.memoryMap.set(key, {
            data: serialized,
            expiresAt: Date.now() + ttlMs,
        })

        // 2. Set L2 Redis cache
        if (redisClient && redisClient.status === 'ready') {
            try {
                await redisClient.set(key, serialized, 'EX', Math.max(1, Math.ceil(ttlSeconds)))
            } catch (err) {
                // Intentionally swallowed: L1 memory cache remains active if Redis is offline
                console.error('[AppCache Redis Set Error]', err)
            }
        }
    }

    /**
     * Invalidate a single cache key.
     */
    async del(key: string): Promise<void> {
        this.memoryMap.delete(key)

        if (redisClient && redisClient.status === 'ready') {
            try {
                await redisClient.del(key)
            } catch (err) {
                // Intentionally swallowed: Redis eviction failure logged without interrupting workflow
                console.error('[AppCache Redis Del Error]', err)
            }
        }
    }

    /**
     * Invalidate keys matching a wildcard pattern (e.g. cache:user:123:*).
     */
    async delPattern(pattern: string): Promise<void> {
        // 1. Evict from L1 memory cache
        const regexStr =
            '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
        const regex = new RegExp(regexStr)

        for (const k of this.memoryMap.keys()) {
            if (regex.test(k)) {
                this.memoryMap.delete(k)
            }
        }

        // 2. Evict from L2 Redis cache
        if (redisClient && redisClient.status === 'ready') {
            try {
                const stream = redisClient.scanStream({
                    match: pattern,
                    count: 100,
                })

                stream.on('data', async (keys: string[]) => {
                    if (keys.length > 0 && redisClient) {
                        try {
                            await redisClient.del(...keys)
                        } catch (err) {
                            // Intentionally swallowed: stream batch delete error
                            console.error('[AppCache Redis Stream Del Batch Error]', err)
                        }
                    }
                })

                await new Promise<void>((resolve) => {
                    stream.on('end', () => resolve())
                    stream.on('error', (err) => {
                        // Intentionally swallowed: scan stream error logged gracefully
                        console.error('[AppCache Redis Scan Stream Error]', err)
                        resolve()
                    })
                })
            } catch (err) {
                // Intentionally swallowed: scan error logged gracefully
                console.error('[AppCache Redis DelPattern Error]', err)
            }
        }
    }

    /**
     * Cache-aside wrapper: returns cached value or executes fn and caches the result.
     */
    async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
        const cached = await this.get<T>(key)
        if (cached !== null) {
            return cached
        }

        const fresh = await fn()
        if (fresh !== undefined && fresh !== null) {
            await this.set(key, fresh, ttlSeconds)
        }
        return fresh
    }

    /**
     * Clear all in-memory entries (primarily used in tests).
     */
    clear(): void {
        this.memoryMap.clear()
    }

    /**
     * Clear all cache entries across L1 memory and L2 Redis (primarily used in tests).
     */
    async clearAll(): Promise<void> {
        this.memoryMap.clear()
        if (redisClient && redisClient.status === 'ready') {
            try {
                await this.delPattern('cache:*')
            } catch (err) {
                // Intentionally swallowed: test cleanup error
                console.error('[AppCache Redis ClearAll Error]', err)
            }
        }
    }
}

export const appCache = new AppCache()
