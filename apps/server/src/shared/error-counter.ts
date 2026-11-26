import { redisClient } from '../config/redis'

import type { NextFunction, Request, Response } from 'express'

const KEY_PREFIX = 'december:errors:5xx:'
const KEEP_SECONDS = 26 * 60 * 60

/** "2026112613" for the UTC hour of a time: one counter for each hour. */
export const errorHourKey = (date: Date): string =>
    `${KEY_PREFIX}${date.toISOString().slice(0, 13).replace(/[-T]/g, '')}`

/**
 * Counts server errors (5xx) for each hour, for the admin system tab. One Redis increment
 * after the response is sent: it never slows or blocks a request.
 */
export const countServerErrors = (_req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
        if (res.statusCode < 500 || !redisClient) return
        const key = errorHourKey(new Date())
        redisClient
            .multi()
            .incr(key)
            .expire(key, KEEP_SECONDS)
            .exec()
            .catch(() => {
                // Intentionally swallowed: the error count is best effort and must not affect requests
            })
    })
    next()
}
