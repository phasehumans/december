import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import {
    recordUsageTurn,
    getWeeklyUsageSummary,
    loadUsageLedger,
    saveUsageLedger,
    formatNumberWithCommas,
} from '../../src/utils/usage-tracker'

describe('Usage Tracker (Unit)', () => {
    let originalEnv: NodeJS.ProcessEnv
    let testBaseDir: string

    beforeEach(async () => {
        originalEnv = { ...process.env }
        testBaseDir = path.join(
            os.tmpdir(),
            `december-usage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        )
        await fs.mkdir(testBaseDir, { recursive: true })
        process.env.DECEMBER_CONFIG_DIR = testBaseDir
    })

    afterEach(async () => {
        process.env = originalEnv
        try {
            await fs.rm(testBaseDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test sandbox cleanup
        }
    })

    it('formats numbers with commas cleanly', () => {
        expect(formatNumberWithCommas(0)).toBe('0')
        expect(formatNumberWithCommas(950)).toBe('950')
        expect(formatNumberWithCommas(12500)).toBe('12,500')
        expect(formatNumberWithCommas(1450200)).toBe('1,450,200')
    })

    it('starts with an empty ledger and zero weekly usage', async () => {
        const ledger = await loadUsageLedger()
        expect(ledger.days).toEqual({})

        const weekly = await getWeeklyUsageSummary()
        expect(weekly.totalTokens).toBe(0)
        expect(weekly.inputTokens).toBe(0)
        expect(weekly.outputTokens).toBe(0)
        expect(weekly.requests).toBe(0)
        expect(weekly.activeDays).toBe(0)
        expect(weekly.topModels).toEqual([])
    })

    it('records a turn and updates the daily and model buckets', async () => {
        const today = new Date().toISOString().slice(0, 10)

        await recordUsageTurn({
            model: 'claude-3-7-sonnet',
            provider: 'anthropic',
            promptTokens: 1000,
            completionTokens: 200,
            cacheReadTokens: 500,
            date: today,
        })

        const ledger = await loadUsageLedger()
        const day = ledger.days[today]
        expect(day).toBeDefined()
        expect(day.inputTokens).toBe(1000)
        expect(day.outputTokens).toBe(200)
        expect(day.cacheReadTokens).toBe(500)
        expect(day.requests).toBe(1)

        const modelBucket = day.models['claude-3-7-sonnet']
        expect(modelBucket).toBeDefined()
        expect(modelBucket.inputTokens).toBe(1000)
        expect(modelBucket.outputTokens).toBe(200)
        expect(modelBucket.cacheReadTokens).toBe(500)
        expect(modelBucket.requests).toBe(1)
    })

    it('accumulates multiple turns across multiple models on the same day', async () => {
        const today = new Date().toISOString().slice(0, 10)

        await recordUsageTurn({
            model: 'claude-3-7-sonnet',
            promptTokens: 1000,
            completionTokens: 200,
            date: today,
        })

        await recordUsageTurn({
            model: 'claude-3-7-sonnet',
            promptTokens: 2000,
            completionTokens: 300,
            date: today,
        })

        await recordUsageTurn({
            model: 'deepseek-chat',
            promptTokens: 5000,
            completionTokens: 1000,
            date: today,
        })

        const ledger = await loadUsageLedger()
        const day = ledger.days[today]
        expect(day.requests).toBe(3)
        expect(day.inputTokens).toBe(8000)
        expect(day.outputTokens).toBe(1500)

        expect(day.models['claude-3-7-sonnet'].requests).toBe(2)
        expect(day.models['claude-3-7-sonnet'].inputTokens).toBe(3000)
        expect(day.models['claude-3-7-sonnet'].outputTokens).toBe(500)

        expect(day.models['deepseek-chat'].requests).toBe(1)
        expect(day.models['deepseek-chat'].inputTokens).toBe(5000)
    })

    it('calculates 7-day rolling weekly summary accurately with model percentages', async () => {
        const now = new Date()
        const formatDate = (daysAgo: number) => {
            const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
            return d.toISOString().slice(0, 10)
        }

        // Today (day 0)
        await recordUsageTurn({
            model: 'claude-3-7-sonnet',
            promptTokens: 7000,
            completionTokens: 1000,
            date: formatDate(0),
        })

        // 2 days ago
        await recordUsageTurn({
            model: 'deepseek-chat',
            promptTokens: 2000,
            completionTokens: 500,
            date: formatDate(2),
        })

        // 5 days ago
        await recordUsageTurn({
            model: 'claude-3-7-sonnet',
            promptTokens: 1000,
            completionTokens: 500,
            date: formatDate(5),
        })

        // 10 days ago (outside 7-day window)
        await recordUsageTurn({
            model: 'gpt-4o',
            promptTokens: 50000,
            completionTokens: 10000,
            date: formatDate(10),
        })

        const weekly = await getWeeklyUsageSummary()
        // 7 days include day 0 (8k), day 2 (2.5k), day 5 (1.5k) => total 12,000 tokens
        expect(weekly.totalTokens).toBe(12000)
        expect(weekly.inputTokens).toBe(10000)
        expect(weekly.outputTokens).toBe(2000)
        expect(weekly.requests).toBe(3)
        expect(weekly.activeDays).toBe(3)

        // Top models: claude-3-7-sonnet has 9,500 tokens (79%), deepseek-chat has 2,500 tokens (21%)
        expect(weekly.topModels.length).toBe(2)
        expect(weekly.topModels[0].model).toBe('claude-3-7-sonnet')
        expect(weekly.topModels[0].totalTokens).toBe(9500)
        expect(weekly.topModels[0].percentage).toBe(79)

        expect(weekly.topModels[1].model).toBe('deepseek-chat')
        expect(weekly.topModels[1].totalTokens).toBe(2500)
        expect(weekly.topModels[1].percentage).toBe(21)
    })

    it('auto-prunes records older than 30 days on save', async () => {
        const ledger = await loadUsageLedger()
        ledger.days['2025-01-01'] = {
            date: '2025-01-01',
            inputTokens: 100,
            outputTokens: 50,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            requests: 1,
            models: {},
        }
        const today = new Date().toISOString().slice(0, 10)
        ledger.days[today] = {
            date: today,
            inputTokens: 500,
            outputTokens: 200,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            requests: 2,
            models: {},
        }

        await saveUsageLedger(ledger)

        const reloaded = await loadUsageLedger()
        expect(reloaded.days['2025-01-01']).toBeUndefined()
        expect(reloaded.days[today]).toBeDefined()
    })
})
