import fs from 'node:fs/promises'
import path from 'node:path'

import { getConfigDir } from '../config'

import type { UsageHistory, UsageTokenBreakdown } from '@december/tui'

/**
 * Local token usage ledger (~/.december/usage.json).
 *
 * One aggregate record per local calendar day. Several december processes can
 * run at once, so every write is a read-modify-write under a lock file.
 * Token buckets do not overlap: input is uncached input only.
 */

export interface UsageModelBucket extends UsageTokenBreakdown {
    requests: number
}

export interface UsageDayRecord extends UsageTokenBreakdown {
    requests: number
    sessions: string[]
    models: Record<string, UsageModelBucket>
}

export interface UsageLedger {
    version: 2
    days: Record<string, UsageDayRecord>
}

export interface RecordUsageParams {
    model?: string
    sessionId?: string
    promptTokens: number
    completionTokens: number
    cacheReadInputTokens?: number
    cacheCreationInputTokens?: number
    promptTokensExcludeCache?: boolean
    at?: Date
}

const RETENTION_DAYS = 366
const LOCK_RETRY_MS = 25
const LOCK_MAX_ATTEMPTS = 80
const LOCK_STALE_MS = 10_000

export function formatNumberWithCommas(n: number): string {
    return Math.round(n).toLocaleString('en-US')
}

export function getUsageFilePath(): string {
    return path.join(getConfigDir(), 'usage.json')
}

function getLockFilePath(): string {
    return path.join(getConfigDir(), 'usage.json.lock')
}

export function localDateKey(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function emptyBreakdown(): UsageTokenBreakdown {
    return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

function sumBreakdown(t: UsageTokenBreakdown): number {
    return t.input + t.output + t.cacheRead + t.cacheWrite
}

function nonNegative(n: unknown): number {
    const value = Number(n)
    return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Converts a provider usage report into non-overlapping buckets. Anthropic
 * reports input without cache tokens; openai and gemini include cache reads in
 * the prompt count.
 */
export function normalizeUsageTokens(params: RecordUsageParams): UsageTokenBreakdown {
    const prompt = nonNegative(params.promptTokens)
    const cacheRead = nonNegative(params.cacheReadInputTokens)
    const cacheWrite = nonNegative(params.cacheCreationInputTokens)
    const input = params.promptTokensExcludeCache
        ? prompt
        : Math.max(0, prompt - cacheRead - cacheWrite)
    return { input, output: nonNegative(params.completionTokens), cacheRead, cacheWrite }
}

function migrateV1(raw: any): UsageLedger {
    const days: Record<string, UsageDayRecord> = {}
    for (const [date, day] of Object.entries<any>(raw.days || {})) {
        const models: Record<string, UsageModelBucket> = {}
        for (const [model, bucket] of Object.entries<any>(day?.models || {})) {
            models[model] = {
                input: nonNegative(bucket?.inputTokens),
                output: nonNegative(bucket?.outputTokens),
                cacheRead: nonNegative(bucket?.cacheReadTokens),
                cacheWrite: nonNegative(bucket?.cacheWriteTokens),
                requests: nonNegative(bucket?.requests),
            }
        }
        days[date] = {
            input: nonNegative(day?.inputTokens),
            output: nonNegative(day?.outputTokens),
            cacheRead: nonNegative(day?.cacheReadTokens),
            cacheWrite: nonNegative(day?.cacheWriteTokens),
            requests: nonNegative(day?.requests),
            sessions: [],
            models,
        }
    }
    return { version: 2, days }
}

export async function loadUsageLedger(): Promise<UsageLedger> {
    try {
        const raw = JSON.parse(await fs.readFile(getUsageFilePath(), 'utf-8'))
        if (raw && typeof raw === 'object' && raw.days && typeof raw.days === 'object') {
            if (raw.version === 2) return raw as UsageLedger
            if (raw.version === 1) return migrateV1(raw)
        }
    } catch {
        // Intentionally swallowed: missing or corrupt ledger starts fresh
    }
    return { version: 2, days: {} }
}

function pruneLedger(ledger: UsageLedger, now: Date): void {
    const cutoff = localDateKey(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - RETENTION_DAYS)
    )
    for (const date of Object.keys(ledger.days)) {
        if (date < cutoff) delete ledger.days[date]
    }
}

async function writeLedger(ledger: UsageLedger): Promise<void> {
    const filePath = getUsageFilePath()
    const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`
    try {
        await fs.writeFile(tmpPath, JSON.stringify(ledger), 'utf-8')
        await fs.rename(tmpPath, filePath)
    } catch (err) {
        await fs.unlink(tmpPath).catch(() => {
            // Intentionally swallowed: tmp file may not exist
        })
        throw err
    }
}

async function withLedgerLock<T>(fn: () => Promise<T>): Promise<T> {
    await fs.mkdir(getConfigDir(), { recursive: true })
    const lockPath = getLockFilePath()

    for (let attempt = 0; attempt < LOCK_MAX_ATTEMPTS; attempt++) {
        try {
            const handle = await fs.open(lockPath, 'wx')
            await handle.close()
            try {
                return await fn()
            } finally {
                await fs.unlink(lockPath).catch(() => {
                    // Intentionally swallowed: lock already removed as stale by another process
                })
            }
        } catch (err: any) {
            if (err?.code !== 'EEXIST') throw err
            const stat = await fs.stat(lockPath).catch(() => null)
            if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
                await fs.unlink(lockPath).catch(() => {
                    // Intentionally swallowed: another process cleared the stale lock first
                })
                continue
            }
            await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS))
        }
    }
    throw new Error('usage ledger is locked')
}

function applyUsage(ledger: UsageLedger, params: RecordUsageParams, at: Date): void {
    const tokens = normalizeUsageTokens(params)
    const date = localDateKey(at)
    const model = (params.model || 'unknown').toLowerCase().trim()

    const day = (ledger.days[date] ??= {
        ...emptyBreakdown(),
        requests: 0,
        sessions: [],
        models: {},
    })
    const bucket = (day.models[model] ??= { ...emptyBreakdown(), requests: 0 })

    for (const target of [day, bucket]) {
        target.input += tokens.input
        target.output += tokens.output
        target.cacheRead += tokens.cacheRead
        target.cacheWrite += tokens.cacheWrite
        target.requests += 1
    }
    if (params.sessionId && !day.sessions.includes(params.sessionId)) {
        day.sessions.push(params.sessionId)
    }
}

// serializes writes inside this process; the lock file covers other processes
let writeChain: Promise<void> = Promise.resolve()

/** Adds one model request to the ledger. Never throws. */
export function recordUsage(params: RecordUsageParams): Promise<void> {
    const tokens = normalizeUsageTokens(params)
    if (sumBreakdown(tokens) <= 0) return writeChain

    const at = params.at ?? new Date()
    writeChain = writeChain.then(() =>
        withLedgerLock(async () => {
            const ledger = await loadUsageLedger()
            applyUsage(ledger, params, at)
            pruneLedger(ledger, at)
            await writeLedger(ledger)
        }).catch(() => {
            // Intentionally swallowed: usage stats must never break an agent turn
        })
    )
    return writeChain
}

export function summarizeUsage(ledger: UsageLedger, now: Date = new Date()): UsageHistory {
    const totals = emptyBreakdown()
    const dailyTokens: Record<string, number> = {}
    const modelTokens: Record<string, number> = {}
    const sessions = new Set<string>()
    const activeDates = new Set<string>()
    const todayKey = localDateKey(now)

    for (const [date, day] of Object.entries(ledger.days)) {
        if (date > todayKey) continue
        const dayTotal = sumBreakdown(day)
        if (dayTotal <= 0) continue

        dailyTokens[date] = dayTotal
        activeDates.add(date)
        totals.input += day.input
        totals.output += day.output
        totals.cacheRead += day.cacheRead
        totals.cacheWrite += day.cacheWrite
        for (const id of day.sessions ?? []) sessions.add(id)
        for (const [model, bucket] of Object.entries(day.models ?? {})) {
            modelTokens[model] = (modelTokens[model] ?? 0) + sumBreakdown(bucket)
        }
    }

    const topModel = Object.entries(modelTokens).sort((a, b) => b[1] - a[1])[0]?.[0]
    const firstDate = [...activeDates].sort()[0]
    let trackedDays = 0
    if (firstDate) {
        const [y, m, d] = firstDate.split('-').map(Number)
        const first = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        trackedDays = Math.round((today.getTime() - first.getTime()) / 86_400_000) + 1
    }

    return {
        ...totals,
        dailyTokens,
        totalTokens: sumBreakdown(totals),
        sessions: sessions.size,
        topModel,
        activeDays: activeDates.size,
        trackedDays,
    }
}

/** Resolves once every usage write queued by this process has finished. */
export function waitForUsageWrites(): Promise<void> {
    return writeChain
}

export async function getUsageHistory(now: Date = new Date()): Promise<UsageHistory> {
    await waitForUsageWrites()
    return summarizeUsage(await loadUsageLedger(), now)
}
