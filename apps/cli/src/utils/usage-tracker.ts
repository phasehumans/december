import fs from 'node:fs/promises'
import path from 'node:path'

import { getConfigDir } from '../config'

export interface ModelUsageBucket {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    requests: number
}

export interface DailyUsageRecord {
    date: string // YYYY-MM-DD
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    requests: number
    models: Record<string, ModelUsageBucket>
}

export interface UsageLedger {
    version: 1
    days: Record<string, DailyUsageRecord>
}

export interface RecordUsageTurnParams {
    model: string
    provider?: string
    promptTokens: number
    completionTokens: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
    date?: string // defaults to current date YYYY-MM-DD
}

export interface TopModelUsage {
    model: string
    totalTokens: number
    percentage: number
}

export interface WeeklyUsageSummary {
    totalTokens: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    requests: number
    activeDays: number
    topModels: TopModelUsage[]
}

export interface SessionUsageSummary {
    requests: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    totalTokens: number
}

export function formatNumberWithCommas(n: number): string {
    return Math.round(n).toLocaleString('en-US')
}

export function getUsageFilePath(): string {
    return path.join(getConfigDir(), 'usage.json')
}

export async function loadUsageLedger(): Promise<UsageLedger> {
    const filePath = getUsageFilePath()
    try {
        const raw = await fs.readFile(filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && parsed.version === 1 && parsed.days) {
            return parsed as UsageLedger
        }
    } catch {
        // Intentionally swallowed: file does not exist or has invalid json, return empty default ledger
    }

    return {
        version: 1,
        days: {},
    }
}

export async function saveUsageLedger(ledger: UsageLedger): Promise<void> {
    const configDir = getConfigDir()
    const filePath = path.join(configDir, 'usage.json')
    const tmpPath = path.join(configDir, `usage.json.tmp.${Date.now()}`)

    // Prune records older than 30 days
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const prunedDays: Record<string, DailyUsageRecord> = {}
    for (const [dateKey, dayRecord] of Object.entries(ledger.days)) {
        if (dateKey >= cutoffDate) {
            prunedDays[dateKey] = dayRecord
        }
    }
    ledger.days = prunedDays

    try {
        await fs.mkdir(configDir, { recursive: true })
        await fs.writeFile(tmpPath, JSON.stringify(ledger, null, 2), 'utf-8')
        await fs.rename(tmpPath, filePath)
    } catch {
        // Intentionally swallowed: disk write failure or permissions issue, clean up tmp
        try {
            await fs.unlink(tmpPath)
        } catch {
            // Intentionally swallowed: cleanup error
        }
    }
}

export async function recordUsageTurn(params: RecordUsageTurnParams): Promise<void> {
    const {
        model,
        promptTokens = 0,
        completionTokens = 0,
        cacheReadTokens = 0,
        cacheWriteTokens = 0,
        date = new Date().toISOString().slice(0, 10),
    } = params

    if (promptTokens <= 0 && completionTokens <= 0) {
        return
    }

    const ledger = await loadUsageLedger()
    const normalizedModel = (model || 'unknown').toLowerCase().trim()

    let day = ledger.days[date]
    if (!day) {
        day = {
            date,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            requests: 0,
            models: {},
        }
        ledger.days[date] = day
    }

    day.inputTokens += promptTokens
    day.outputTokens += completionTokens
    day.cacheReadTokens += cacheReadTokens
    day.cacheWriteTokens += cacheWriteTokens
    day.requests += 1

    let modelBucket = day.models[normalizedModel]
    if (!modelBucket) {
        modelBucket = {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            requests: 0,
        }
        day.models[normalizedModel] = modelBucket
    }

    modelBucket.inputTokens += promptTokens
    modelBucket.outputTokens += completionTokens
    modelBucket.cacheReadTokens += cacheReadTokens
    modelBucket.cacheWriteTokens += cacheWriteTokens
    modelBucket.requests += 1

    await saveUsageLedger(ledger)
}

export async function getWeeklyUsageSummary(): Promise<WeeklyUsageSummary> {
    const ledger = await loadUsageLedger()
    const now = new Date()

    const last7Days: string[] = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        last7Days.push(d.toISOString().slice(0, 10))
    }

    let inputTokens = 0
    let outputTokens = 0
    let cacheReadTokens = 0
    let requests = 0
    let activeDays = 0
    const modelTokensMap: Record<string, number> = {}

    for (const dateKey of last7Days) {
        const day = ledger.days[dateKey]
        if (!day) continue

        const dayTokens = day.inputTokens + day.outputTokens
        if (day.requests > 0 || dayTokens > 0) {
            activeDays++
        }

        inputTokens += day.inputTokens
        outputTokens += day.outputTokens
        cacheReadTokens += day.cacheReadTokens || 0
        requests += day.requests

        if (day.models) {
            for (const [modelName, bucket] of Object.entries(day.models)) {
                const totalModelTokens = bucket.inputTokens + bucket.outputTokens
                modelTokensMap[modelName] = (modelTokensMap[modelName] || 0) + totalModelTokens
            }
        }
    }

    const totalTokens = inputTokens + outputTokens

    const topModels: TopModelUsage[] = Object.entries(modelTokensMap)
        .map(([model, tokens]) => ({
            model,
            totalTokens: tokens,
            percentage: totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0,
        }))
        .sort((a, b) => b.totalTokens - a.totalTokens)

    return {
        totalTokens,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        requests,
        activeDays,
        topModels,
    }
}
