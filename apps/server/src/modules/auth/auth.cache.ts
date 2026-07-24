import type { CachedSessionData } from './auth.types'

interface CacheEntry {
    data: CachedSessionData
    expiresAt: number
}

const DEFAULT_TTL_MS = 15 * 1000 // 15 seconds short TTL

class SessionCache {
    private cache = new Map<string, CacheEntry>()

    get(sessionId: string): CachedSessionData | null {
        const entry = this.cache.get(sessionId)
        if (!entry) return null
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(sessionId)
            return null
        }
        return entry.data
    }

    set(sessionId: string, data: CachedSessionData, ttlMs = DEFAULT_TTL_MS): void {
        this.cache.set(sessionId, {
            data,
            expiresAt: Date.now() + ttlMs,
        })
    }

    invalidate(sessionId: string): void {
        this.cache.delete(sessionId)
    }

    invalidateUser(userId: string): void {
        for (const [sessionId, entry] of this.cache.entries()) {
            if (entry.data.userId === userId) {
                this.cache.delete(sessionId)
            }
        }
    }

    clear(): void {
        this.cache.clear()
    }
}

export const sessionCache = new SessionCache()
