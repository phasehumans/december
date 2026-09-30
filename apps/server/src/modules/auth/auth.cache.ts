import { redisClient } from '../../config/redis'

import type { CachedSessionData } from './auth.types'

interface CacheEntry {
    data: CachedSessionData
    expiresAt: number
}

const DEFAULT_TTL_MS = 15 * 60 * 1000 // 15 minutes TTL for local fallback memory
const REDIS_TTL_MS = 15 * 60 * 1000 // 15 minutes TTL for Redis cache

class SessionCache {
    private cache = new Map<string, CacheEntry>()

    async get(sessionId: string): Promise<CachedSessionData | null> {
        // 1. If Redis is ready, fetch directly from Redis for zero-database validation and instant cross-node revocation
        if (redisClient && redisClient.status === 'ready') {
            try {
                const dataStr = await redisClient.get(`sess:cache:${sessionId}`)
                if (dataStr) {
                    const parsed = JSON.parse(dataStr) as CachedSessionData
                    if (parsed.expiresAt) {
                        parsed.expiresAt = new Date(parsed.expiresAt)
                    }
                    return parsed
                }
                return null
            } catch (err) {
                // Intentionally swallowed: fallback to local memory cache if Redis command fails
                console.error('[SessionCache Redis Get Error]', err)
            }
        }

        // 2. Fallback to local memory cache if Redis is unavailable or offline
        const entry = this.cache.get(sessionId)
        if (entry) {
            if (Date.now() <= entry.expiresAt) {
                return entry.data
            }
            this.cache.delete(sessionId)
        }

        return null
    }

    async set(sessionId: string, data: CachedSessionData, ttlMs = REDIS_TTL_MS): Promise<void> {
        // Maintain local fallback memory entry
        this.cache.set(sessionId, {
            data,
            expiresAt: Date.now() + ttlMs,
        })

        if (redisClient && redisClient.status === 'ready') {
            try {
                const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000))
                await redisClient.set(`sess:cache:${sessionId}`, JSON.stringify(data), 'EX', ttlSec)
                if (data.userId) {
                    await redisClient.sadd(`user:sessions:${data.userId}`, sessionId)
                    await redisClient.expire(`user:sessions:${data.userId}`, 30 * 24 * 60 * 60)
                }
            } catch (err) {
                console.error('[SessionCache Redis Set Error]', err)
            }
        }
    }

    async invalidate(sessionId: string): Promise<void> {
        this.cache.delete(sessionId)
        if (redisClient && redisClient.status === 'ready') {
            try {
                await redisClient.del(`sess:cache:${sessionId}`)
            } catch (err) {
                console.error('[SessionCache Redis Invalidate Error]', err)
            }
        }
    }

    async invalidateUser(userId: string): Promise<void> {
        for (const [sessionId, entry] of this.cache.entries()) {
            if (entry.data.userId === userId) {
                this.cache.delete(sessionId)
            }
        }
        if (redisClient && redisClient.status === 'ready') {
            try {
                const sessionIds = await redisClient.smembers(`user:sessions:${userId}`)
                if (sessionIds.length > 0) {
                    const keys = sessionIds.map((id) => `sess:cache:${id}`)
                    await redisClient.del(...keys)
                    await redisClient.del(`user:sessions:${userId}`)
                }
            } catch (err) {
                console.error('[SessionCache Redis InvalidateUser Error]', err)
            }
        }
    }

    clear(): void {
        this.cache.clear()
    }
}

export const sessionCache = new SessionCache()
