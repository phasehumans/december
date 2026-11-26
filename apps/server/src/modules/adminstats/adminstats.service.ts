import { promises as fs } from 'fs'
import os from 'os'
import { monitorEventLoopDelay } from 'perf_hooks'

import { getAgentQueue, getEmailQueue, getRedisClient } from '@december/shared/queue'
import { Queue } from 'bullmq'

import { redisClient } from '../../config/redis'
import { env } from '../../env'
import { errorHourKey } from '../../shared/error-counter'
import { SERVER_STARTS_KEY } from '../../shared/server-starts'

import { adminstatsRepository } from './adminstats.repository'
import {
    DAY_MS,
    cached,
    istDayKeys,
    istStartOfToday,
    istStartOfWeek,
    istWeekKeys,
    toNumber,
    withTimeout,
} from './adminstats.utils'

import type {
    CheckStatus,
    FailedJob,
    FreshOption,
    HealthCheck,
    TrendWindow,
    QueueCounts,
    StatsWindow,
    WorkerBeat,
} from './adminstats.types'

const ANALYTICS_TTL_SECONDS = 5 * 60
const HEALTH_TTL_SECONDS = 30
const CHECK_TIMEOUT_MS = 2000

// how long the event loop waits behind other work: a sign the server is overloaded
const loopDelay = monitorEventLoopDelay({ resolution: 20 })
loopDelay.enable()

const worst = (statuses: CheckStatus[]): CheckStatus =>
    statuses.includes('down') ? 'down' : statuses.includes('warn') ? 'warn' : 'ok'

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

/** The start of the window: midnight in India time, days - 1 days ago. */
const windowStart = (days: number) => new Date(istStartOfToday().getTime() - (days - 1) * DAY_MS)

/** Fills days with no rows with zeros, so every chart has every day. */
const fillDays = <T extends { day: string }>(days: number, rows: T[], empty: Omit<T, 'day'>) => {
    const byDay = new Map(rows.map((row) => [row.day, row]))
    return istDayKeys(days).map((day) => byDay.get(day) ?? ({ day, ...empty } as T))
}

// ----- system health (H1 to H6) -----

const QUEUES: Array<{ name: string; label: string }> = [
    { name: 'agent_jobs', label: 'Agent runs' },
    { name: 'sweep_jobs', label: 'Sweeps' },
    { name: 'email_jobs', label: 'Emails' },
    { name: 'minio_wipe', label: 'Storage cleanup' },
]

const queueObjects = new Map<string, Queue>()
const getQueue = (name: string): Queue => {
    if (name === 'agent_jobs') return getAgentQueue()
    if (name === 'email_jobs') return getEmailQueue() as unknown as Queue
    let queue = queueObjects.get(name)
    if (!queue) {
        queue = new Queue(name, { connection: getRedisClient() as any })
        queueObjects.set(name, queue)
    }
    return queue
}

const readQueue = async (data: { name: string; label: string }): Promise<QueueCounts> => {
    const { name, label } = data
    try {
        const counts = await withTimeout(
            getQueue(name).getJobCounts('waiting', 'active', 'delayed', 'failed'),
            CHECK_TIMEOUT_MS,
            `queue ${name}`
        )
        const waiting = counts.waiting ?? 0
        return {
            name,
            label,
            // a long line of waiting jobs means the worker is behind or stopped
            status: waiting > 100 ? 'down' : waiting > 20 ? 'warn' : 'ok',
            waiting,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
        }
    } catch (err: any) {
        return {
            name,
            label,
            status: 'down',
            waiting: 0,
            active: 0,
            delayed: 0,
            failed: 0,
            error: err?.message ?? 'not reachable',
        }
    }
}

// the worker writes one field each into this hash every 30 seconds (apps/worker/src/heartbeat.ts)
const HEARTBEAT_HASH = 'december:worker:heartbeats'
const DROP_QUIET_WORKER_MS = 10 * 60 * 1000

const readWorkers = async (): Promise<WorkerBeat[]> => {
    if (!redisClient) return []
    const fields = await redisClient.hgetall(HEARTBEAT_HASH)
    const beats: WorkerBeat[] = []
    for (const [field, value] of Object.entries(fields)) {
        let beat: {
            host?: string
            at?: string
            memoryMb?: number
            jobsDoneLastHour?: number
            jobsFailedLastHour?: number
        } = {}
        try {
            beat = JSON.parse(value)
        } catch (err) {
            console.warn('[adminstats] bad worker heartbeat', field, err)
        }
        const at = beat.at ? Date.parse(beat.at) : NaN
        if (!Number.isFinite(at) || Date.now() - at > DROP_QUIET_WORKER_MS) {
            // a worker that stopped without saying so: forget it
            redisClient.hdel(HEARTBEAT_HASH, field).catch(() => {
                // Intentionally swallowed: the next read tries again
            })
            continue
        }
        beats.push({
            host: beat.host ?? field,
            at: new Date(at).toISOString(),
            secondsAgo: Math.round((Date.now() - at) / 1000),
            memoryMb: typeof beat.memoryMb === 'number' ? beat.memoryMb : null,
            jobsDoneLastHour:
                typeof beat.jobsDoneLastHour === 'number' ? beat.jobsDoneLastHour : null,
            jobsFailedLastHour:
                typeof beat.jobsFailedLastHour === 'number' ? beat.jobsFailedLastHour : null,
        })
    }
    return beats.sort((a, b) => a.secondsAgo - b.secondsAgo)
}

const readErrors = async () => {
    const hours = Array.from({ length: 24 }, (_, i) => new Date(Date.now() - (23 - i) * 3600000))
    if (!redisClient) return hours.map((hour) => ({ hour: hour.toISOString(), count: 0 }))
    const values = await redisClient.mget(hours.map(errorHourKey))
    return hours.map((hour, i) => ({
        hour: hour.toISOString().slice(0, 13) + ':00:00.000Z',
        count: toNumber(values[i]),
    }))
}

const check = async <T>(
    label: string,
    run: () => Promise<T>
): Promise<{ ok: true; value: T; ms: number } | { ok: false; error: string; ms: number }> => {
    const started = Date.now()
    try {
        const value = await withTimeout(run(), CHECK_TIMEOUT_MS, label)
        return { ok: true, value, ms: Date.now() - started }
    } catch (err: any) {
        return { ok: false, error: err?.message ?? `${label} failed`, ms: Date.now() - started }
    }
}

/** "1.2 GB" */
const bytesText = (bytes: number) =>
    bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`

/**
 * E1 and E2: the machine the server runs on. In a Docker container the load and
 * /proc/meminfo are the host's, and "/" sits on the host disk where Docker keeps images and
 * logs, so these are the EC2 machine's numbers.
 */
const readMachine = async () => {
    const [load1 = 0, load5 = 0, load15 = 0] = os.loadavg()
    const cores = Math.max(1, os.cpus().length)

    let memTotal = os.totalmem()
    let memAvailable = os.freemem()
    try {
        const info = await fs.readFile('/proc/meminfo', 'utf8')
        const kb = (name: string) => Number(info.match(new RegExp(`^${name}:\\s+(\\d+)`, 'm'))?.[1])
        // MemAvailable counts memory the system can free for new work, unlike MemFree
        if (Number.isFinite(kb('MemTotal'))) memTotal = kb('MemTotal') * 1024
        if (Number.isFinite(kb('MemAvailable'))) memAvailable = kb('MemAvailable') * 1024
    } catch {
        // Intentionally swallowed: not Linux, the os numbers above are used
    }

    const disk = await fs.statfs('/')
    const diskTotal = disk.blocks * disk.bsize
    const diskFree = disk.bavail * disk.bsize
    const diskUsedPct = diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100) : 0
    const memUsedPct = memTotal > 0 ? Math.round(((memTotal - memAvailable) / memTotal) * 100) : 0
    const loadPerCore = load5 / cores

    const status: CheckStatus =
        diskUsedPct >= 90 || memUsedPct >= 95 || loadPerCore >= 2
            ? 'down'
            : diskUsedPct >= 80 || memUsedPct >= 85 || loadPerCore >= 1
              ? 'warn'
              : 'ok'
    return {
        status,
        detail: `disk ${diskUsedPct}% used, memory ${memUsedPct}% used`,
        load: [load1, load5, load15].map((n) => Math.round(n * 100) / 100),
        cores,
        memoryUsedPct: memUsedPct,
        memoryText: `${bytesText(memTotal - memAvailable)} of ${bytesText(memTotal)}`,
        diskUsedPct,
        diskText: `${bytesText(diskTotal - diskFree)} of ${bytesText(diskTotal)}, ${bytesText(diskFree)} free`,
    }
}

/** E4: when the API server last started, and how often in the last 24 hours. */
const readServerStarts = async () => {
    if (!redisClient) return { lastStartAt: null, startsLastDay: null, recentStarts: [] }
    const starts = await redisClient.lrange(SERVER_STARTS_KEY, 0, 49)
    const dayAgo = Date.now() - DAY_MS
    return {
        lastStartAt: starts[0] ?? null,
        startsLastDay: starts.filter((at) => Date.parse(at) >= dayAgo).length,
        // S3: the last few starts, newest first
        recentStarts: starts.slice(0, 5),
    }
}

const loadHealth = async () => {
    const [
        db,
        dbStats,
        redisPing,
        redisMemory,
        queues,
        workers,
        errors,
        sandboxes,
        machine,
        starts,
    ] = await Promise.all([
        check('database', () => adminstatsRepository.pingDatabase()),
        check('database stats', () => adminstatsRepository.databaseStats()),
        check('redis', async () => {
            if (!redisClient) throw new Error('REDIS_URL is not set')
            return redisClient.ping()
        }),
        check('redis memory', async () => {
            if (!redisClient) throw new Error('REDIS_URL is not set')
            const info = await redisClient.info('memory')
            const usedBytes = Number(info.match(/^used_memory:(\d+)/m)?.[1] ?? 0)
            // 0 means Redis has no memory limit set
            const maxBytes = Number(info.match(/^maxmemory:(\d+)/m)?.[1] ?? 0)
            return { usedBytes, maxBytes }
        }),
        Promise.all(QUEUES.map(readQueue)),
        check('workers', readWorkers),
        check('errors', readErrors),
        check('sandboxes', () => adminstatsRepository.sandboxCounts()),
        check('machine', readMachine),
        check('server starts', readServerStarts),
    ])

    const memory = process.memoryUsage()
    const loopP99Ms = Math.round(loopDelay.percentile(99) / 1e6)
    loopDelay.reset()

    const startsLastDay = starts.ok ? starts.value.startsLastDay : null
    const server: HealthCheck & Record<string, unknown> = {
        // more than 3 starts in a day looks like a crash loop
        status:
            loopP99Ms > 500 || (startsLastDay ?? 0) > 3
                ? (startsLastDay ?? 0) > 10
                    ? 'down'
                    : 'warn'
                : 'ok',
        detail: `up ${Math.round(process.uptime() / 60)} min`,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(memory.rss / 1048576),
        heapMb: Math.round(memory.heapUsed / 1048576),
        eventLoopP99Ms: loopP99Ms,
        commit: env.GIT_SHA ?? null,
        runtime: typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`,
        host: os.hostname(),
        lastStartAt: starts.ok ? starts.value.lastStartAt : null,
        recentStarts: starts.ok ? starts.value.recentStarts : [],
        startsLastDay,
    }

    const machineCheck: HealthCheck & Record<string, unknown> = machine.ok
        ? machine.value
        : { status: 'warn', detail: machine.error }

    const database: HealthCheck & Record<string, unknown> = db.ok
        ? {
              status: db.ms > 500 ? 'warn' : 'ok',
              detail: `${db.ms} ms`,
              pingMs: db.ms,
              connections: dbStats.ok ? dbStats.value?.connections : null,
              maxConnections: dbStats.ok ? dbStats.value?.maxConnections : null,
              sizeText:
                  dbStats.ok && dbStats.value ? bytesText(toNumber(dbStats.value.sizeBytes)) : null,
          }
        : { status: 'down', detail: db.error, pingMs: null }

    const redisMem = redisMemory.ok ? redisMemory.value : null
    const redisFull = redisMem && redisMem.maxBytes > 0 ? redisMem.usedBytes / redisMem.maxBytes : 0
    const redis: HealthCheck & Record<string, unknown> = redisPing.ok
        ? {
              status: redisPing.ms > 200 || redisFull > 0.8 ? 'warn' : 'ok',
              detail: `${redisPing.ms} ms`,
              pingMs: redisPing.ms,
              memory: redisMem
                  ? redisMem.maxBytes > 0
                      ? `${bytesText(redisMem.usedBytes)} of ${bytesText(redisMem.maxBytes)}`
                      : `${bytesText(redisMem.usedBytes)} (no limit set)`
                  : null,
          }
        : { status: 'down', detail: redisPing.error, pingMs: null }

    const beats = workers.ok ? workers.value : []
    const freshest = beats[0]
    const worker: HealthCheck & Record<string, unknown> = !workers.ok
        ? { status: 'down', detail: workers.error, workers: [] }
        : !freshest
          ? { status: 'down', detail: 'no worker has checked in', workers: [] }
          : {
                status:
                    freshest.secondsAgo > 120 ? 'down' : freshest.secondsAgo > 60 ? 'warn' : 'ok',
                detail: `last seen ${freshest.secondsAgo} s ago`,
                workers: beats,
            }

    const hourly = errors.ok ? errors.value : []
    const lastHour = hourly.at(-1)?.count ?? 0
    const errorCheck: HealthCheck & Record<string, unknown> = {
        status: lastHour > 50 ? 'down' : lastHour > 5 ? 'warn' : 'ok',
        detail: `${lastHour} in the last hour`,
        hourly,
    }

    const sandboxRows = sandboxes.ok ? sandboxes.value : []
    const sandboxCount = (status: string) =>
        sandboxRows.find((row) => row.sandboxStatus === status)?._count._all ?? 0

    const queueStatus = worst(queues.map((queue) => queue.status))
    const result = {
        checkedAt: new Date().toISOString(),
        server,
        machine: machineCheck,
        database,
        redis,
        worker,
        queues: { status: queueStatus, detail: '', items: queues },
        errors: errorCheck,
        sandboxes: {
            starting: sandboxCount('STARTING'),
            running: sandboxCount('RUNNING'),
            paused: sandboxCount('PAUSED'),
        },
    }
    return {
        ...result,
        status: worst([
            server.status,
            machineCheck.status,
            database.status,
            redis.status,
            worker.status,
            queueStatus,
            errorCheck.status,
        ]),
    }
}

const getHealth = async (data: FreshOption = {}) => {
    const { fresh } = data
    return cached('health', HEALTH_TTL_SECONDS, loadHealth, { fresh })
}

/** The latest failed jobs: name, error and time only. Job data can hold prompts, so it is never sent. */
const getFailedJobs = async (data: FreshOption = {}) =>
    cached(
        'failed-jobs',
        HEALTH_TTL_SECONDS,
        async () => {
            const lists = await Promise.all(
                QUEUES.map(async ({ name }) => {
                    try {
                        const jobs = await withTimeout(
                            getQueue(name).getFailed(0, 9),
                            CHECK_TIMEOUT_MS,
                            `failed jobs ${name}`
                        )
                        return jobs.map(
                            (job): FailedJob => ({
                                queue: name,
                                id: job.id,
                                name: job.name,
                                reason: (job.failedReason ?? '').slice(0, 300),
                                attempts: job.attemptsMade,
                                failedAt: job.finishedOn
                                    ? new Date(job.finishedOn).toISOString()
                                    : null,
                            })
                        )
                    } catch (err) {
                        console.warn(`[adminstats] could not read failed jobs for ${name}`, err)
                        return []
                    }
                })
            )
            const items = lists
                .flat()
                .sort((a, b) => (b.failedAt ?? '').localeCompare(a.failedAt ?? ''))
                .slice(0, 20)
            const dayAgo = Date.now() - DAY_MS
            return {
                items,
                lastDay: items.filter((job) => job.failedAt && Date.parse(job.failedAt) >= dayAgo)
                    .length,
            }
        },
        { fresh: data.fresh }
    )

// ----- public status (S1) -----

// what users see on trydecember.com/status, from Better Stack (checked from outside)
const PUBLIC_STATUS_URL = 'https://status.trydecember.com/index.json'
const PUBLIC_STATES = ['operational', 'degraded', 'downtime', 'maintenance'] as const
type PublicState = (typeof PUBLIC_STATES)[number]
// Better Stack's day states, worst first
const DAY_SEVERITY = [
    'downtime',
    'degraded',
    'recovered',
    'maintenance',
    'operational',
    'not_monitored',
] as const
const DAY_WORDS: Record<string, string> = {
    downtime: 'down',
    degraded: 'slow',
    recovered: 'some downtime, recovered',
    maintenance: 'maintenance',
}

const asPublicState = (value: unknown): PublicState | null =>
    PUBLIC_STATES.find((state) => state === value) ?? null

type BetterStackResource = {
    type?: string
    attributes?: {
        public_name?: string
        status?: string
        status_history?: Array<{ day?: string; status?: string }>
    }
}

/** The public status page, as the server reads it: the same data /status shows. */
const loadPublicStatus = async () => {
    // tests never call outside services
    if (process.env.NODE_ENV === 'test') return EMPTY_PUBLIC_STATUS
    {
        const res = await fetch(PUBLIC_STATUS_URL, {
            signal: AbortSignal.timeout(CHECK_TIMEOUT_MS * 3),
        })
        if (!res.ok) throw new Error(`status page answered ${res.status}`)
        const json = (await res.json()) as {
            data?: { attributes?: { aggregate_state?: string; announcement?: string | null } }
            included?: BetterStackResource[]
        }
        const resources = (json.included ?? []).filter(
            (item) => item.type === 'status_page_resource' && item.attributes?.public_name?.trim()
        )
        const services = resources.map((item) => ({
            name: item.attributes!.public_name!.trim(),
            state: asPublicState(item.attributes?.status),
        }))
        // one entry a day for the whole system: the worst state of any service that day
        const byDay = new Map<string, Array<{ name: string; status: string }>>()
        for (const item of resources) {
            const name = item.attributes!.public_name!.trim()
            for (const entry of item.attributes?.status_history ?? []) {
                if (typeof entry.day !== 'string' || typeof entry.status !== 'string') continue
                const list = byDay.get(entry.day) ?? []
                list.push({ name, status: entry.status })
                byDay.set(entry.day, list)
            }
        }
        const days = [...byDay.keys()]
            .sort()
            .slice(-90)
            .map((day) => {
                const list = byDay.get(day) ?? []
                const status =
                    DAY_SEVERITY.find((state) => list.some((x) => x.status === state)) ??
                    'not_monitored'
                return {
                    day,
                    status,
                    problems: list
                        .filter((x) => DAY_WORDS[x.status])
                        .map((x) => `${x.name} ${DAY_WORDS[x.status]}`),
                }
            })
        const announcement = (json.data?.attributes?.announcement ?? '')
            .replace(/<[^>]*>/g, '')
            .trim()
        return {
            available: true,
            overall: asPublicState(json.data?.attributes?.aggregate_state),
            announcement: announcement || null,
            services,
            days,
        }
    }
}

const EMPTY_PUBLIC_STATUS = {
    available: false,
    overall: null,
    announcement: null,
    services: [],
    days: [],
}

/** A failed read is not cached, so the next refresh tries again. */
const getPublicStatus = async (data: FreshOption = {}) => {
    const { fresh } = data
    try {
        return await cached('public-status', 60, loadPublicStatus, { fresh })
    } catch (err) {
        console.warn('[adminstats] could not read the public status', err)
        return EMPTY_PUBLIC_STATUS
    }
}

// ----- overview (V1) -----

const getOverview = async (data: FreshOption = {}) =>
    cached(
        'overview',
        60,
        async () => {
            const todayStart = istStartOfToday()
            // the system's state lives on the System tab only
            const [counts, signups, failed] = await Promise.all([
                adminstatsRepository.overviewCounts({
                    todayStart,
                    dayAgo: daysAgo(1),
                    monthAgo: daysAgo(30),
                }),
                adminstatsRepository.signupsByDay(windowStart(7)),
                getFailedJobs({ fresh: data.fresh }),
            ])
            return {
                signupsToday: counts.signupsToday,
                signups7d: signups.reduce(
                    (sum, row) => sum + row.github + row.google + row.email,
                    0
                ),
                activeDay: counts.activeDay,
                agentsWorking: counts.agentsWorking,
                sandboxesRunning: counts.sandboxesRunning,
                creditsSpentTodayCents: toNumber(counts.creditsSpentToday),
                paid30dCents: toNumber(counts.paidMonth),
                needsYou: {
                    pendingRequests: counts.pendingRequests,
                    feedbackWeek: counts.feedbackWeek,
                    failedJobsDay: failed.lastDay,
                },
            }
        },
        { fresh: data.fresh }
    )

/**
 * O2: the Overview chart. Every tile but System has a line: signups, users who made a model
 * call, sessions started (the history of "agents working now"), credits used and money
 * paid. Per India day for 7, 30 and 90 days; per India week (52 points) for a year.
 */
const getTrend = async (data: TrendWindow & FreshOption) => {
    const { days, fresh } = data
    const bucket = days > 90 ? ('week' as const) : ('day' as const)
    return cached(
        `trend:${days}`,
        ANALYTICS_TTL_SECONDS,
        async () => {
            const keys = bucket === 'week' ? istWeekKeys(52) : istDayKeys(days)
            const since =
                bucket === 'week'
                    ? istStartOfWeek(51)
                    : new Date(istStartOfToday().getTime() - (days - 1) * DAY_MS)
            const rows = await adminstatsRepository.trend({ since, bucket })
            const lookup = (list: Array<{ day: string; value: unknown }>) =>
                new Map(list.map((row) => [row.day, Math.round(toNumber(row.value))]))
            const signups = lookup(rows.signups)
            const active = lookup(rows.active)
            const sessions = lookup(rows.sessions)
            const credits = lookup(rows.credits)
            const paid = lookup(rows.paid)
            return {
                days,
                bucket,
                points: keys.map((day) => ({
                    day,
                    signups: signups.get(day) ?? 0,
                    active: active.get(day) ?? 0,
                    sessions: sessions.get(day) ?? 0,
                    creditsCents: credits.get(day) ?? 0,
                    paidCents: paid.get(day) ?? 0,
                })),
            }
        },
        { fresh }
    )
}

// ----- analytics: the five things that matter now (K1 to K5) -----

const getAnalytics = async (data: StatsWindow) => {
    const { days } = data
    // v2: the product fields (A2 to A7); a new key so a cached answer from before a deploy
    // never reaches the new page
    return cached(`analytics:v2:${days}`, ANALYTICS_TTL_SECONDS, async () => {
        const since = windowStart(days)
        const [signups, summary, cohorts, money, prs, product] = await Promise.all([
            adminstatsRepository.signupsByDay(since),
            adminstatsRepository.growthSummary({
                dayAgo: daysAgo(1),
                weekAgo: daysAgo(7),
                monthAgo: daysAgo(30),
            }),
            adminstatsRepository.weeklyCohorts(istStartOfWeek(7)),
            adminstatsRepository.moneyByWeek(since),
            adminstatsRepository.prsByWeek(since),
            adminstatsRepository.productStats(since),
        ])
        const { outcomes } = product
        return {
            days,
            // A2: of the users who signed up in the window
            funnel: product.funnel,
            // A3: users by where they worked, per week
            channels: product.channels,
            // A4: what the sessions started in the window led to
            outcomes: {
                ...outcomes,
                medianMergeHours:
                    outcomes.medianMergeHours === null
                        ? null
                        : Math.round(toNumber(outcomes.medianMergeHours) * 10) / 10,
            },
            // A5: of the users active in the window
            features: product.features,
            // A6
            models: product.models.map((row) => ({
                ...row,
                cents: Math.round(toNumber(row.cents)),
            })),
            keyProviders: product.keyProviders,
            // A7
            signupMethods: signups.reduce(
                (sum, row) => ({
                    github: sum.github + row.github,
                    google: sum.google + row.google,
                    email: sum.email + row.email,
                }),
                { github: 0, google: 0, email: 0 }
            ),
            heardFrom: product.heardFrom,
            referrals: product.referrals,
            // A8: active users and the cohorts; stickiness is day over month
            active: summary.active,
            cohorts,
            // money per week: paid, free credits given, credits used
            wallet: money.wallet.map((row) => ({ ...row, cents: toNumber(row.cents) })),
            spent: money.spent.map((row) => ({ ...row, cents: toNumber(row.cents) })),
            // pull requests per week
            prWeeks: prs.weeks,
        }
    })
}

export const adminstatsService = {
    getPublicStatus,
    getAnalytics,
    getOverview,
    getTrend,
    getHealth,
    getFailedJobs,
}
