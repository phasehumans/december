import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import {
    formatNumberWithCommas,
    getUsageFilePath,
    loadUsageLedger,
    normalizeUsageTokens,
    recordUsage,
    summarizeUsage,
    type UsageDayRecord,
    type UsageLedger,
} from '../../src/utils/usage-tracker'

function day(partial: Partial<UsageDayRecord> & { model?: string }): UsageDayRecord {
    const tokens = {
        input: partial.input ?? 0,
        output: partial.output ?? 0,
        cacheRead: partial.cacheRead ?? 0,
        cacheWrite: partial.cacheWrite ?? 0,
    }
    return {
        ...tokens,
        requests: partial.requests ?? 1,
        sessions: partial.sessions ?? [],
        models: partial.models ?? { [partial.model ?? 'model-a']: { ...tokens, requests: 1 } },
    }
}

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
        expect(formatNumberWithCommas(1450200)).toBe('1,450,200')
    })

    describe('normalizeUsageTokens', () => {
        it('keeps anthropic input as-is because it already excludes cache tokens', () => {
            expect(
                normalizeUsageTokens({
                    promptTokens: 14,
                    completionTokens: 4900,
                    cacheReadInputTokens: 408_600,
                    cacheCreationInputTokens: 60_100,
                    promptTokensExcludeCache: true,
                })
            ).toEqual({ input: 14, output: 4900, cacheRead: 408_600, cacheWrite: 60_100 })
        })

        it('subtracts cache reads from openai-style prompt counts', () => {
            expect(
                normalizeUsageTokens({
                    promptTokens: 10_000,
                    completionTokens: 500,
                    cacheReadInputTokens: 8_000,
                })
            ).toEqual({ input: 2_000, output: 500, cacheRead: 8_000, cacheWrite: 0 })
        })

        it('treats missing, negative and non-numeric counts as zero', () => {
            expect(
                normalizeUsageTokens({
                    promptTokens: -5,
                    completionTokens: Number.NaN,
                    cacheReadInputTokens: undefined,
                })
            ).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
        })
    })

    describe('recordUsage', () => {
        it('starts with an empty ledger', async () => {
            expect(await loadUsageLedger()).toEqual({ version: 2, days: {} })
        })

        it('records day, model and session buckets', async () => {
            const at = new Date(2026, 10, 20, 12)
            await recordUsage({
                model: 'Claude-Opus-5-5',
                sessionId: 's1',
                promptTokens: 100,
                completionTokens: 50,
                cacheReadInputTokens: 1000,
                promptTokensExcludeCache: true,
                at,
            })
            await recordUsage({
                model: 'claude-opus-5-5',
                sessionId: 's1',
                promptTokens: 200,
                completionTokens: 10,
                at,
            })

            const ledger = await loadUsageLedger()
            const record = ledger.days['2026-11-20']!
            expect(record.input).toBe(300)
            expect(record.output).toBe(60)
            expect(record.cacheRead).toBe(1000)
            expect(record.requests).toBe(2)
            expect(record.sessions).toEqual(['s1'])
            expect(record.models['claude-opus-5-5']!.requests).toBe(2)
        })

        it('ignores reports with no tokens', async () => {
            await recordUsage({ promptTokens: 0, completionTokens: 0 })
            await expect(fs.access(getUsageFilePath())).rejects.toThrow()
        })

        it('does not lose concurrent writes from the same process', async () => {
            const at = new Date(2026, 10, 20, 12)
            await Promise.all(
                Array.from({ length: 25 }, (_, i) =>
                    recordUsage({
                        sessionId: `s${i % 3}`,
                        promptTokens: 10,
                        completionTokens: 1,
                        at,
                    })
                )
            )
            const record = (await loadUsageLedger()).days['2026-11-20']!
            expect(record.requests).toBe(25)
            expect(record.input).toBe(250)
            expect(record.sessions.sort()).toEqual(['s0', 's1', 's2'])
        })

        it('waits for a lock held by another process before writing', async () => {
            const lockPath = path.join(testBaseDir, 'usage.json.lock')
            await fs.writeFile(lockPath, '')
            setTimeout(() => {
                void fs.unlink(lockPath)
            }, 100)

            await recordUsage({ promptTokens: 5, completionTokens: 5 })
            const ledger = await loadUsageLedger()
            expect(Object.values(ledger.days)[0]!.requests).toBe(1)
        })

        it('clears a stale lock left by a crashed process', async () => {
            const lockPath = path.join(testBaseDir, 'usage.json.lock')
            await fs.writeFile(lockPath, '')
            const old = new Date(Date.now() - 60_000)
            await fs.utimes(lockPath, old, old)

            await recordUsage({ promptTokens: 5, completionTokens: 5 })
            expect(Object.keys((await loadUsageLedger()).days)).toHaveLength(1)
        })

        it('prunes days older than a year on write', async () => {
            const now = new Date(2026, 10, 20, 12)
            const ledger: UsageLedger = {
                version: 2,
                days: {
                    '2025-01-01': day({ input: 1 }),
                    '2026-01-01': day({ input: 1 }),
                },
            }
            await fs.writeFile(getUsageFilePath(), JSON.stringify(ledger))

            await recordUsage({ promptTokens: 1, completionTokens: 1, at: now })
            expect(Object.keys((await loadUsageLedger()).days).sort()).toEqual([
                '2026-01-01',
                '2026-11-20',
            ])
        })

        it('migrates a version 1 ledger', async () => {
            await fs.writeFile(
                getUsageFilePath(),
                JSON.stringify({
                    version: 1,
                    days: {
                        '2026-11-19': {
                            date: '2026-11-19',
                            inputTokens: 100,
                            outputTokens: 20,
                            cacheReadTokens: 5,
                            cacheWriteTokens: 0,
                            requests: 2,
                            models: {
                                'gpt-4o': {
                                    inputTokens: 100,
                                    outputTokens: 20,
                                    cacheReadTokens: 5,
                                    cacheWriteTokens: 0,
                                    requests: 2,
                                },
                            },
                        },
                    },
                })
            )
            const ledger = await loadUsageLedger()
            expect(ledger.version).toBe(2)
            expect(ledger.days['2026-11-19']).toEqual({
                input: 100,
                output: 20,
                cacheRead: 5,
                cacheWrite: 0,
                requests: 2,
                sessions: [],
                models: {
                    'gpt-4o': { input: 100, output: 20, cacheRead: 5, cacheWrite: 0, requests: 2 },
                },
            })
        })
    })

    describe('summarizeUsage', () => {
        const now = new Date(2026, 10, 20, 15)

        it('returns zeros for an empty ledger', () => {
            const summary = summarizeUsage({ version: 2, days: {} }, now)
            expect(summary.totalTokens).toBe(0)
            expect(summary.activeDays).toBe(0)
            expect(summary.trackedDays).toBe(0)
            expect(summary.topModel).toBeUndefined()
        })

        it('aggregates totals, sessions, top model and active days', () => {
            const ledger: UsageLedger = {
                version: 2,
                days: {
                    '2026-11-01': day({ input: 10, sessions: ['a'], model: 'small' }),
                    '2026-11-02': day({ input: 10, sessions: ['a'], model: 'small' }),
                    '2026-11-03': day({ input: 10, sessions: ['b'], model: 'small' }),
                    '2026-11-18': day({
                        output: 500,
                        cacheRead: 5000,
                        sessions: ['c'],
                        model: 'big',
                    }),
                    '2026-11-19': day({
                        input: 20,
                        cacheWrite: 30,
                        sessions: ['c', 'd'],
                        model: 'big',
                    }),
                    // future-dated and empty records are ignored
                    '2026-11-25': day({ input: 999_999 }),
                    '2026-11-10': day({ requests: 0 }),
                },
            }

            const summary = summarizeUsage(ledger, now)
            expect(summary.input).toBe(50)
            expect(summary.output).toBe(500)
            expect(summary.cacheRead).toBe(5000)
            expect(summary.cacheWrite).toBe(30)
            expect(summary.totalTokens).toBe(5580)
            expect(summary.sessions).toBe(4)
            expect(summary.topModel).toBe('big')
            expect(summary.activeDays).toBe(5)
            expect(summary.trackedDays).toBe(20)
            expect(summary.dailyTokens['2026-11-19']).toBe(50)
            expect(summary.dailyTokens['2026-11-25']).toBeUndefined()
        })
    })
})
