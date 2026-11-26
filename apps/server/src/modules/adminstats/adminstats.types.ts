export type StatsWindow = {
    days: number
}

export type TrendWindow = {
    // 7, 30 or 90 (by day) or 365 (by week), checked by the schema
    days: number
}

export type CheckStatus = 'ok' | 'warn' | 'down'

export type HealthCheck = {
    status: CheckStatus
    detail: string
}

export type QueueCounts = {
    name: string
    label: string
    status: CheckStatus
    waiting: number
    active: number
    delayed: number
    failed: number
    error?: string
}

export type FailedJob = {
    queue: string
    id: string | undefined
    name: string
    reason: string
    attempts: number
    failedAt: string | null
}

export type WorkerBeat = {
    host: string
    at: string
    secondsAgo: number
    memoryMb: number | null
    jobsDoneLastHour: number | null
    jobsFailedLastHour: number | null
}

export type FreshOption = {
    // true skips the short cache (the Refresh button)
    fresh?: boolean
}
