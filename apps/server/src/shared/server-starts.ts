import { redisClient } from '../config/redis'

// E4: the last 50 times the API server started, newest first, for the admin system tab
export const SERVER_STARTS_KEY = 'december:server:starts'

/** Notes one start. Best effort: a start must never wait on Redis. */
export const recordServerStart = () => {
    if (!redisClient) return
    redisClient
        .multi()
        .lpush(SERVER_STARTS_KEY, new Date().toISOString())
        .ltrim(SERVER_STARTS_KEY, 0, 49)
        .exec()
        .catch(() => {
            // Intentionally swallowed: the restart count is only a hint on the admin page
        })
}
