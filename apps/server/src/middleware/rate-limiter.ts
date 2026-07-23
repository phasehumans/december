import rateLimit from 'express-rate-limit'
import Redis from 'ioredis'
import RedisStore from 'rate-limit-redis'

import { env } from '../env'

let redisStoreInstance: RedisStore | undefined

if (env.REDIS_URL) {
    try {
        const client = new Redis(env.REDIS_URL)
        redisStoreInstance = new RedisStore({
            // @ts-expect-error ioredis sendCommand signature compatibility
            sendCommand: (...args: string[]) => client.call(...args),
        })
    } catch {
        // Fallback to memory store if Redis initialization fails
    }
}

export interface RateLimiterOptions {
    windowMs?: number
    limit?: number
    message?: string
}

export const createRateLimiter = (options: RateLimiterOptions = {}) => {
    const windowMs = options.windowMs || 15 * 60 * 1000
    const limit = options.limit || 500
    const message = options.message || 'Too many requests, please try again later.'

    return rateLimit({
        windowMs,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        store: redisStoreInstance,
        validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
        keyGenerator: (req) => {
            if ((req as any).user?.userId) {
                return `user:${(req as any).user.userId}`
            }
            const apiKey = req.headers['x-api-key'] || req.headers['authorization']
            if (apiKey && typeof apiKey === 'string') {
                return `token:${apiKey}`
            }
            const clientIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress
            return `ip:${String(clientIp || 'unknown')}`
        },
        handler: (_req, res) => {
            const retryAfterSec = Math.ceil(windowMs / 1000)
            res.status(429).json({
                success: false,
                message,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: retryAfterSec,
                },
            })
        },
    })
}

// Global baseline rate limiter (500 req / 15 min)
export const globalRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    message: 'Global API rate limit exceeded',
})

// Strict rate limiters for specific sensitive modules
export const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    message: 'Too many authentication attempts, please try again after 15 minutes',
})

export const runtimeRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: 30,
    message: 'Too many runtime execution requests, please try again in a minute',
})

export const cliRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: 60,
    message: 'CLI rate limit exceeded',
})

export const deviceCodeLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: 'Too many device code generation requests, please try again after 15 minutes',
})

// Alias export for backward compatibility
export const apiRateLimiter = globalRateLimiter
