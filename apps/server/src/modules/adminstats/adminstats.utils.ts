import { redisClient } from '../../config/redis'

export const DAY_MS = 24 * 60 * 60 * 1000

// days and weeks are counted in India time, where the team works
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

/** Midnight today in India time, as a real instant. */
export const istStartOfToday = (now = Date.now()): Date =>
    new Date(Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS)

/** Monday 00:00 India time of this week, minus n weeks (weeks start on Monday, as in Postgres). */
export const istStartOfWeek = (weeksBack = 0, now = Date.now()): Date => {
    const today = istStartOfToday(now)
    // the India date's weekday: 0 is Sunday
    const weekday = new Date(today.getTime() + IST_OFFSET_MS).getUTCDay()
    const daysSinceMonday = (weekday + 6) % 7
    return new Date(today.getTime() - (daysSinceMonday + weeksBack * 7) * DAY_MS)
}

/** "2026-11-26" for each of the last n India days, oldest first. */
export const istDayKeys = (days: number, now = Date.now()): string[] => {
    const today = istStartOfToday(now).getTime() + IST_OFFSET_MS
    return Array.from({ length: days }, (_, i) =>
        new Date(today - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10)
    )
}

/** The Monday ("2026-11-23") of each of the last n India weeks, oldest first. */
export const istWeekKeys = (weeks: number, now = Date.now()): string[] =>
    Array.from({ length: weeks }, (_, i) =>
        new Date(istStartOfWeek(weeks - 1 - i, now).getTime() + IST_OFFSET_MS)
            .toISOString()
            .slice(0, 10)
    )

/** Rejects when a check takes longer than ms, so one slow part can't hang the page (G4). */
export const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} took over ${ms} ms`)), ms)
        promise.then(
            (value) => {
                clearTimeout(timer)
                resolve(value)
            },
            (err) => {
                clearTimeout(timer)
                reject(err)
            }
        )
    })

/**
 * Keeps a result in Redis for ttlSeconds (G2), so reloading the admin page runs the
 * queries once. Without Redis, or when Redis fails, it just runs the query.
 */
export const cached = async <T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
    options: { fresh?: boolean } = {}
) => {
    const fullKey = `december:adminstats:${key}`
    // tests read their own fresh rows every time
    const useCache = Boolean(redisClient) && process.env.NODE_ENV !== 'test'
    // the Refresh button skips the read but still saves the new result
    if (useCache && redisClient && !options.fresh) {
        try {
            const hit = await withTimeout(redisClient.get(fullKey), 500, 'cache read')
            if (hit) return JSON.parse(hit) as T
        } catch (err) {
            console.warn('[adminstats] cache read failed, running the query', err)
        }
    }
    const value = await load()
    if (useCache && redisClient) {
        redisClient.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds).catch(() => {
            // Intentionally swallowed: a missed cache write only means the next load runs the query
        })
    }
    return value
}

export const toNumber = (value: unknown): number => {
    if (typeof value === 'bigint') return Number(value)
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value) || 0
    return 0
}
