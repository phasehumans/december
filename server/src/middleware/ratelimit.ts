import type { Request, Response, NextFunction } from 'express'

interface RateLimitConfig {
    windowMs: number
    max: number
    message?: string
}

export const createRateLimiter = (config: RateLimitConfig) => {
    const requests = new Map<string, { count: number; resetTime: number }>()

    return (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown'
        const key = `${req.path}:${ip}`
        const now = Date.now()

        const record = requests.get(key)

        if (!record || now > record.resetTime) {
            requests.set(key, {
                count: 1,
                resetTime: now + config.windowMs,
            })
            return next()
        }

        if (record.count >= config.max) {
            return res.status(429).json({
                success: false,
                message: config.message || 'Too many requests, please try again later.',
            })
        }

        record.count += 1
        return next()
    }
}
