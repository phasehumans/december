import { createRateLimiter as createRateLimiterImpl } from './rate-limiter'

interface RateLimitConfig {
    windowMs: number
    max: number
    message?: string
}

export const createRateLimiter = (config: RateLimitConfig) => {
    return createRateLimiterImpl({
        windowMs: config.windowMs,
        limit: config.max,
        message: config.message,
    })
}
