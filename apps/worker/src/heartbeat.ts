import os from 'os'

const BEAT_MS = 30_000
const HOUR_MS = 60 * 60 * 1000
// one hash for all workers: the admin system tab reads it with one HGETALL
const HEARTBEAT_HASH = 'december:worker:heartbeats'

type RedisLike = {
    hset: (key: string, field: string, value: string) => Promise<unknown>
    hdel: (key: string, field: string) => Promise<unknown>
}

type JobEvents = {
    on: (event: 'completed' | 'failed', listener: (...args: any[]) => void) => unknown
}

/** Job finish times of the last hour, so "alive but stuck" shows on the system tab (E3). */
const recentJobs = () => {
    const times: number[] = []
    return {
        add: () => times.push(Date.now()),
        countLastHour: () => {
            const since = Date.now() - HOUR_MS
            while (times.length > 0 && (times[0] ?? 0) < since) times.shift()
            return times.length
        },
    }
}

/**
 * Tells the admin system tab this worker is alive (H4) and how it is doing (E3): one small
 * Redis write every 30 seconds. With BETTERSTACK_WORKER_HEARTBEAT_URL set, it also pings
 * Better Stack, which emails the team when the pings stop (E6). A failed write or ping is
 * skipped; the next one tries again. The server drops entries quiet for 10 minutes.
 */
export const startWorkerHeartbeat = (data: { redis: RedisLike; jobs?: JobEvents }) => {
    const { redis, jobs } = data
    const field = `${os.hostname()}:${process.pid}`
    const done = recentJobs()
    const failed = recentJobs()
    jobs?.on('completed', () => done.add())
    jobs?.on('failed', () => failed.add())

    const betterStackUrl = process.env.BETTERSTACK_WORKER_HEARTBEAT_URL?.trim()

    const beat = () => {
        const value = JSON.stringify({
            host: os.hostname(),
            at: new Date().toISOString(),
            memoryMb: Math.round(process.memoryUsage().rss / 1048576),
            jobsDoneLastHour: done.countLastHour(),
            jobsFailedLastHour: failed.countLastHour(),
        })
        redis.hset(HEARTBEAT_HASH, field, value).catch(() => {
            // Intentionally swallowed: a missed beat only shows the worker as quiet for a moment
        })
    }

    const pingBetterStack = () => {
        if (!betterStackUrl) return
        fetch(betterStackUrl, { signal: AbortSignal.timeout(10_000) }).catch(() => {
            // Intentionally swallowed: Better Stack alerts only after several missed pings
        })
    }

    beat()
    pingBetterStack()
    const timer = setInterval(beat, BEAT_MS)
    // Better Stack heartbeats expect about one ping a minute
    const pingTimer = setInterval(pingBetterStack, 60_000)
    timer.unref?.()
    pingTimer.unref?.()
    return {
        stop: async () => {
            clearInterval(timer)
            clearInterval(pingTimer)
            await redis.hdel(HEARTBEAT_HASH, field).catch(() => {
                // Intentionally swallowed: the server drops quiet entries after 10 minutes
            })
        },
    }
}
