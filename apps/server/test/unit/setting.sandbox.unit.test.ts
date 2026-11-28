import { DEFAULT_IDLE_STOP_MINUTES, IDLE_STOP_MINUTES } from '@december/shared'
import { afterEach, describe, expect, it } from 'bun:test'

import { errorHandler } from '../../src/middleware/error.middleware'
import { sessionRepository } from '../../src/modules/session/session.repository'
import { sessionService } from '../../src/modules/session/session.service'
import { settingRepository } from '../../src/modules/setting/setting.repository'
import { updateSandboxSettingsSchema } from '../../src/modules/setting/setting.schema'
import { settingService } from '../../src/modules/setting/setting.service'
import { toSandboxSettings } from '../../src/modules/setting/setting.utils'
import { AppError } from '../../src/shared/appError'
import { createMockResponse } from '../helpers'

// the sandbox settings page (#637): its schema, the read of saved values, the service
// functions behind GET/PATCH /setting/sandbox and GET /session/sandboxes
describe('sandbox settings - unit', () => {
    describe('updateSandboxSettingsSchema', () => {
        it('takes each choice of the page', () => {
            for (const idleStopMinutes of [10, 30, 60]) {
                expect(updateSandboxSettingsSchema.parse({ idleStopMinutes })).toEqual({
                    idleStopMinutes,
                })
            }
            for (const archiveAfterDays of [7, 30, null]) {
                expect(updateSandboxSettingsSchema.parse({ archiveAfterDays })).toEqual({
                    archiveAfterDays,
                })
            }
            expect(
                updateSandboxSettingsSchema.parse({ idleStopMinutes: 30, archiveAfterDays: 7 })
            ).toEqual({ idleStopMinutes: 30, archiveAfterDays: 7 })
        })

        it('the idle choices are the ones the worker knows', () => {
            for (const idleStopMinutes of IDLE_STOP_MINUTES) {
                expect(updateSandboxSettingsSchema.safeParse({ idleStopMinutes }).success).toBe(
                    true
                )
            }
        })

        it('refuses any other value, type or key', () => {
            const bodies: unknown[] = [
                {},
                { idleStopMinutes: 15 },
                { idleStopMinutes: '10' },
                { idleStopMinutes: null },
                { idleStopMinutes: 10.0001 },
                { archiveAfterDays: 1 },
                { archiveAfterDays: '30' },
                { archiveAfterDays: false },
                { setupCommands: [] },
                { idleStopMinutes: 10, userId: 'someone' },
                [],
                'idle',
                null,
            ]
            for (const body of bodies) {
                expect(updateSandboxSettingsSchema.safeParse(body).success).toBe(false)
            }
        })

        it('says which values are allowed', () => {
            const result = updateSandboxSettingsSchema.safeParse({ idleStopMinutes: 5 })
            expect(result.success).toBe(false)
            expect(JSON.stringify(result.error?.flatten())).toContain(
                'idleStopMinutes must be 10, 30 or 60'
            )
        })
    })

    describe('toSandboxSettings', () => {
        it('keeps saved values that are choices', () => {
            expect(toSandboxSettings({ idleStopMinutes: 60, archiveAfterDays: 7 })).toEqual({
                idleStopMinutes: 60,
                archiveAfterDays: 7,
            })
            expect(toSandboxSettings({ idleStopMinutes: 30, archiveAfterDays: null })).toEqual({
                idleStopMinutes: 30,
                archiveAfterDays: null,
            })
        })

        it('reads a value that is not a choice as the default', () => {
            expect(toSandboxSettings({ idleStopMinutes: 45, archiveAfterDays: 14 })).toEqual({
                idleStopMinutes: DEFAULT_IDLE_STOP_MINUTES,
                archiveAfterDays: null,
            })
            expect(toSandboxSettings({ idleStopMinutes: 0, archiveAfterDays: 0 })).toEqual({
                idleStopMinutes: DEFAULT_IDLE_STOP_MINUTES,
                archiveAfterDays: null,
            })
        })

        it('has no setup commands any more', () => {
            expect(
                Object.keys(toSandboxSettings({ idleStopMinutes: 10, archiveAfterDays: null }))
            ).toEqual(['idleStopMinutes', 'archiveAfterDays'])
        })
    })

    describe('settingService sandbox functions', () => {
        const originalFind = settingRepository.findSandboxSettings
        const originalUpdate = settingRepository.updateSandboxSettings
        const originalArchive = settingRepository.archiveInactiveSessions
        const originalInvalidate = sessionService.invalidateRecentSessions

        afterEach(() => {
            settingRepository.findSandboxSettings = originalFind
            settingRepository.updateSandboxSettings = originalUpdate
            settingRepository.archiveInactiveSessions = originalArchive
            sessionService.invalidateRecentSessions = originalInvalidate
        })

        it('getSandboxSettings: 404 for a user that is gone', async () => {
            settingRepository.findSandboxSettings = (async () => null) as any

            await expect(settingService.getSandboxSettings({ userId: 'u1' })).rejects.toThrow(
                new AppError('user not found', 404)
            )
        })

        it('getSandboxSettings: reads the row of that user only', async () => {
            const asked: string[] = []
            settingRepository.findSandboxSettings = (async (userId: string) => {
                asked.push(userId)
                return { idleStopMinutes: 30, archiveAfterDays: 30 }
            }) as any

            expect(await settingService.getSandboxSettings({ userId: 'u1' })).toEqual({
                idleStopMinutes: 30,
                archiveAfterDays: 30,
            })
            expect(asked).toEqual(['u1'])
        })

        it('updateSandboxSettings: writes only the given fields and answers with all', async () => {
            const writes: Array<{ userId: string; settings: unknown }> = []
            settingRepository.updateSandboxSettings = (async (userId: string, settings: any) => {
                writes.push({ userId, settings })
                return { id: userId }
            }) as any
            settingRepository.findSandboxSettings = (async () => ({
                idleStopMinutes: 10,
                archiveAfterDays: null,
            })) as any

            const result = await settingService.updateSandboxSettings({
                userId: 'u1',
                settings: { archiveAfterDays: null },
            })

            expect(writes).toEqual([{ userId: 'u1', settings: { archiveAfterDays: null } }])
            expect(result).toEqual({ idleStopMinutes: 10, archiveAfterDays: null })
        })

        it('archiveInactiveSessions: clears the recent list of each changed user', async () => {
            const now = new Date('2026-11-28T00:00:00.000Z')
            let askedAt: Date | null = null
            settingRepository.archiveInactiveSessions = (async (at: Date) => {
                askedAt = at
                return ['u1', 'u2']
            }) as any
            const cleared: string[] = []
            sessionService.invalidateRecentSessions = (async ({ userId }: { userId: string }) => {
                cleared.push(userId)
            }) as any

            const result = await settingService.archiveInactiveSessions({ now })

            expect(askedAt as Date | null).toEqual(now)
            expect(cleared.sort()).toEqual(['u1', 'u2'])
            expect(result).toEqual({ users: 2 })
        })

        it('has no setup commands function any more', () => {
            expect('updateSetupCommands' in settingService).toBe(false)
            expect('upsertSetupCommands' in settingRepository).toBe(false)
            expect('deleteSetupCommands' in settingRepository).toBe(false)
        })
    })

    describe('sessionService.getRunningSandboxes', () => {
        const originalFind = sessionRepository.findRunningSandboxes
        const originalSum = sessionRepository.sumCreditCostBySession

        afterEach(() => {
            sessionRepository.findRunningSandboxes = originalFind
            sessionRepository.sumCreditCostBySession = originalSum
        })

        it('maps each session to a row, and sums the cost of these sessions only', async () => {
            const asked: { userId?: string; ids?: string[] } = {}
            sessionRepository.findRunningSandboxes = (async (userId: string) => {
                asked.userId = userId
                return [
                    {
                        id: 's1',
                        title: 'Fix login',
                        githubRepoOwner: 'acme',
                        githubRepoName: 'web',
                        createdAt: new Date('2026-11-20T08:00:00Z'),
                        sandboxStartedAt: new Date('2026-11-25T09:00:00Z'),
                        sandboxStatus: 'RUNNING',
                    },
                    {
                        id: 's2',
                        title: null,
                        githubRepoOwner: null,
                        githubRepoName: null,
                        createdAt: new Date('2026-11-25T10:00:00Z'),
                        sandboxStartedAt: null,
                        sandboxStatus: 'STARTING',
                    },
                ]
            }) as any
            sessionRepository.sumCreditCostBySession = (async (ids: string[]) => {
                asked.ids = ids
                return new Map([['s1', 42.5]])
            }) as any

            const result = await sessionService.getRunningSandboxes({ userId: 'u1' })

            expect(asked).toEqual({ userId: 'u1', ids: ['s1', 's2'] })
            expect(result).toEqual({
                items: [
                    {
                        sessionId: 's1',
                        title: 'Fix login',
                        repoFullName: 'acme/web',
                        startedAt: new Date('2026-11-25T09:00:00Z'),
                        costInCents: 42.5,
                        sandboxStatus: 'RUNNING',
                    },
                    {
                        sessionId: 's2',
                        title: null,
                        repoFullName: null,
                        // no saved start: the start of the session
                        startedAt: new Date('2026-11-25T10:00:00Z'),
                        costInCents: 0,
                        sandboxStatus: 'STARTING',
                    },
                ],
            })
        })

        it('an empty list asks for no costs', async () => {
            sessionRepository.findRunningSandboxes = (async () => []) as any
            const result = await sessionService.getRunningSandboxes({ userId: 'u1' })
            expect(result).toEqual({ items: [] })
        })
    })

    describe('sessionService.stopSession', () => {
        const originalFind = sessionRepository.findSessionRunState

        afterEach(() => {
            sessionRepository.findSessionRunState = originalFind
        })

        it("answers 404 when the session is not the user's", async () => {
            const asked: Array<[string, string]> = []
            sessionRepository.findSessionRunState = (async (sessionId: string, userId: string) => {
                asked.push([sessionId, userId])
                return null
            }) as any

            await expect(
                sessionService.stopSession({ userId: 'u2', sessionId: 's1' })
            ).rejects.toThrow(new AppError('Session not found', 404))
            // the owner is part of the look up
            expect(asked).toEqual([['s1', 'u2']])
        })
    })

    describe('a body the JSON parser refused', () => {
        const run = (err: unknown) => {
            const res = createMockResponse() as any
            errorHandler(err, { originalUrl: '/api/v1/setting/sandbox' } as any, res, () => {})
            return res
        }

        it('is a 400, not a server error', () => {
            const err = Object.assign(new SyntaxError('Unexpected token'), {
                type: 'entity.parse.failed',
                status: 400,
            })
            const res = run(err)
            expect(res.statusCode).toBe(400)
            expect(res.body).toMatchObject({ success: false, message: 'invalid request body' })
            // the parser text does not reach the client
            expect(JSON.stringify(res.body)).not.toContain('Unexpected token')
        })

        it('a body that is too large is a 413', () => {
            const res = run(
                Object.assign(new Error('too large'), { type: 'entity.too.large', status: 413 })
            )
            expect(res.statusCode).toBe(413)
            expect(res.body.message).toBe('request body too large')
        })

        it('other errors are still a 500', () => {
            const res = run(new Error('boom'))
            expect(res.statusCode).toBe(500)
        })
    })
})
