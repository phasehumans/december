import { redisClient } from '../config/redis'

/**
 * Every server node gets the worker's session events (socket.ts relays them), so a side
 * effect such as an email must be claimed first. Redis makes the claim across nodes; with
 * no Redis (tests, local) a map in this process does.
 */

const local = new Map<string, number>()

const redisReady = () => redisClient !== undefined && redisClient.status === 'ready'

const localHas = (key: string) => {
    const expiresAt = local.get(key)
    if (expiresAt === undefined) return false
    if (expiresAt > Date.now()) return true
    local.delete(key)
    return false
}

/** true for the first caller of a key until it expires, false for every other one */
export const claimOnce = async (key: string, ttlSeconds: number): Promise<boolean> => {
    if (redisReady()) {
        try {
            return (await redisClient!.set(key, '1', 'EX', ttlSeconds, 'NX')) === 'OK'
        } catch (error) {
            // Intentionally swallowed: fall back to this process so the event is not lost
            console.warn('[claimOnce] redis failed, using local state', error)
        }
    }
    if (localHas(key)) return false
    local.set(key, Date.now() + ttlSeconds * 1000)
    return true
}

/** marks a key for a while, for a later takeFlag */
export const setFlag = async (key: string, ttlSeconds: number): Promise<void> => {
    if (redisReady()) {
        try {
            await redisClient!.set(key, '1', 'EX', ttlSeconds)
            return
        } catch (error) {
            // Intentionally swallowed: fall back to this process
            console.warn('[setFlag] redis failed, using local state', error)
        }
    }
    local.set(key, Date.now() + ttlSeconds * 1000)
}

/** true when the key was marked; the mark is removed */
export const takeFlag = async (key: string): Promise<boolean> => {
    if (redisReady()) {
        try {
            return (await redisClient!.getdel(key)) !== null
        } catch (error) {
            // Intentionally swallowed: fall back to this process
            console.warn('[takeFlag] redis failed, using local state', error)
        }
    }
    const had = localHas(key)
    local.delete(key)
    return had
}
