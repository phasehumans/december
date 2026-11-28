import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { sessionRepository } from '../../src/modules/session/session.repository'
import { settingRepository } from '../../src/modules/setting/setting.repository'
import { settingService } from '../../src/modules/setting/setting.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// #637 section 4: the sandbox settings of a user (setup commands were removed 2026-11-28)
describe('sandbox settings (#637)', () => {
    const stamp = Date.now()
    let owner: { userId: string; token: string }
    let stranger: { userId: string; token: string }

    const as = (token: string) => {
        const call = (method: 'get' | 'patch' | 'put', path: string) =>
            request(app)
                [method](`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
        return {
            get: (path: string) => call('get', path),
            patch: (path: string) => call('patch', path),
            put: (path: string) => call('put', path),
        }
    }

    beforeAll(async () => {
        owner = await createSignedInUser({ email: `sandbox-settings-${stamp}@example.com` })
        stranger = await createSignedInUser({
            email: `sandbox-settings-other-${stamp}@example.com`,
        })
    })

    beforeEach(async () => {
        const ids = [owner.userId, stranger.userId]
        await prisma.user.updateMany({
            where: { id: { in: ids } },
            data: { idleStopMinutes: 10, archiveAfterDays: null },
        })
    })

    afterAll(async () => {
        for (const id of [owner.userId, stranger.userId]) {
            await cleanupTestUser({ id })
        }
    })

    describe('GET /setting/sandbox', () => {
        it('starts on 10 minutes idle and no archive', async () => {
            const res = await as(owner.token).get('/setting/sandbox')

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ idleStopMinutes: 10, archiveAfterDays: null })
        })

        it('needs a signed in user', async () => {
            const res = await request(app)
                .get('/api/v1/setting/sandbox')
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(401)
        })

        it('refuses a token that is not valid', async () => {
            const res = await as('not-a-token').get('/setting/sandbox')
            expect(res.status).toBe(401)
        })

        it('reads a value that is not a choice any more as the default', async () => {
            // a value from an older version, written straight to the database
            await prisma.user.update({
                where: { id: owner.userId },
                data: { idleStopMinutes: 45, archiveAfterDays: 14 },
            })

            const res = await as(owner.token).get('/setting/sandbox')

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ idleStopMinutes: 10, archiveAfterDays: null })
        })

        it('each user reads only their own settings', async () => {
            await prisma.user.update({
                where: { id: stranger.userId },
                data: { idleStopMinutes: 60, archiveAfterDays: 30 },
            })

            const mine = await as(owner.token).get('/setting/sandbox')
            const theirs = await as(stranger.token).get('/setting/sandbox')

            expect(mine.body.data).toEqual({ idleStopMinutes: 10, archiveAfterDays: null })
            expect(theirs.body.data).toEqual({ idleStopMinutes: 60, archiveAfterDays: 30 })
        })
    })

    describe('PATCH /setting/sandbox', () => {
        it('saves the idle time and answers with all the settings', async () => {
            const saved = await as(owner.token)
                .patch('/setting/sandbox')
                .send({ idleStopMinutes: 30 })

            expect(saved.status).toBe(200)
            expect(saved.body.data).toEqual({ idleStopMinutes: 30, archiveAfterDays: null })

            const read = await as(owner.token).get('/setting/sandbox')
            expect(read.body.data.idleStopMinutes).toBe(30)
            // the other user keeps the default
            const other = await as(stranger.token).get('/setting/sandbox')
            expect(other.body.data.idleStopMinutes).toBe(10)
        })

        it('saves archive after 7 days and keeps the idle time', async () => {
            await as(owner.token).patch('/setting/sandbox').send({ idleStopMinutes: 60 })
            const saved = await as(owner.token)
                .patch('/setting/sandbox')
                .send({ archiveAfterDays: 7 })

            expect(saved.status).toBe(200)
            expect(saved.body.data).toMatchObject({ idleStopMinutes: 60, archiveAfterDays: 7 })
        })

        it('turns the archive off with null', async () => {
            await as(owner.token).patch('/setting/sandbox').send({ archiveAfterDays: 30 })
            const saved = await as(owner.token)
                .patch('/setting/sandbox')
                .send({ archiveAfterDays: null })

            expect(saved.status).toBe(200)
            expect(saved.body.data.archiveAfterDays).toBeNull()
        })

        it('saves both fields in one call', async () => {
            const saved = await as(owner.token)
                .patch('/setting/sandbox')
                .send({ idleStopMinutes: 60, archiveAfterDays: 30 })

            expect(saved.status).toBe(200)
            expect(saved.body.data).toEqual({ idleStopMinutes: 60, archiveAfterDays: 30 })
        })

        it('needs a signed in user, and saves nothing without one', async () => {
            const res = await request(app)
                .patch('/api/v1/setting/sandbox')
                .set('x-forwarded-for', getRandomIP())
                .send({ idleStopMinutes: 60 })

            expect(res.status).toBe(401)
            const read = await as(owner.token).get('/setting/sandbox')
            expect(read.body.data.idleStopMinutes).toBe(10)
        })

        it('refuses a body that is not an object', async () => {
            for (const body of ['[]', '"30"', '30', 'null']) {
                const res = await as(owner.token)
                    .patch('/setting/sandbox')
                    .set('Content-Type', 'application/json')
                    .send(body)
                expect(res.status).toBe(400)
            }
        })

        it('a user id in the body changes nothing for that user', async () => {
            const res = await as(owner.token)
                .patch('/setting/sandbox')
                .send({ idleStopMinutes: 60, userId: stranger.userId })

            expect(res.status).toBe(400)
            const theirs = await as(stranger.token).get('/setting/sandbox')
            expect(theirs.body.data.idleStopMinutes).toBe(10)
        })

        it('refuses a value that is not a choice, and saves nothing', async () => {
            const bodies = [
                { idleStopMinutes: 15 },
                { idleStopMinutes: 0 },
                { idleStopMinutes: -10 },
                { idleStopMinutes: 10.5 },
                { idleStopMinutes: '30' },
                { idleStopMinutes: null },
                { idleStopMinutes: true },
                { idleStopMinutes: [10] },
                { archiveAfterDays: 14 },
                { archiveAfterDays: 0 },
                { archiveAfterDays: '7' },
                { archiveAfterDays: 'never' },
                { archiveAfterDays: { days: 7 } },
                { machineSize: 'large' },
                { setupCommands: [] },
                { idleStopMinutes: 30, extra: 1 },
                {},
            ]
            for (const body of bodies) {
                const res = await as(owner.token).patch('/setting/sandbox').send(body)
                expect(res.status).toBe(400)
            }

            const read = await as(owner.token).get('/setting/sandbox')
            expect(read.body.data).toMatchObject({ idleStopMinutes: 10, archiveAfterDays: null })
        })
    })

    describe('PUT /setting/sandbox/setup-commands (removed)', () => {
        it('is gone: setup commands are no longer saved', async () => {
            const res = await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'acme/web', commands: 'npm ci' })

            expect(res.status).toBe(404)
        })
    })

    describe('the repository functions', () => {
        afterAll(async () => {
            await prisma.session.deleteMany({
                where: { userId: { in: [owner.userId, stranger.userId] } },
            })
        })

        it('findSandboxSettings and updateSandboxSettings touch one user only', async () => {
            await settingRepository.updateSandboxSettings(owner.userId, { idleStopMinutes: 60 })

            expect(await settingRepository.findSandboxSettings(owner.userId)).toEqual({
                idleStopMinutes: 60,
                archiveAfterDays: null,
            })
            expect(await settingRepository.findSandboxSettings(stranger.userId)).toEqual({
                idleStopMinutes: 10,
                archiveAfterDays: null,
            })
            expect(
                await settingRepository.findSandboxSettings('00000000-0000-4000-8000-000000000000')
            ).toBeNull()
        })

        it('findSessionRunState finds a session only for its owner', async () => {
            const session = await prisma.session.create({
                data: { userId: owner.userId, title: 'run state', sandboxStatus: 'RUNNING' },
            })

            expect(await sessionRepository.findSessionRunState(session.id, owner.userId)).toEqual({
                id: session.id,
                vmId: null,
                vmStatus: session.vmStatus,
                sandboxStatus: 'RUNNING',
            })
            expect(await sessionRepository.findSessionRunState(session.id, stranger.userId)).toBe(
                null
            )
        })

        it('findRunningSandboxes counts a start as stale after 15 minutes', async () => {
            await prisma.session.deleteMany({ where: { userId: owner.userId } })
            const starting = await prisma.session.create({
                data: { userId: owner.userId, title: 'starting', sandboxStatus: 'STARTING' },
            })
            await prisma.session.create({
                data: { userId: stranger.userId, title: 'theirs', sandboxStatus: 'STARTING' },
            })
            const in14 = new Date(Date.now() + 14 * 60 * 1000)
            const in16 = new Date(Date.now() + 16 * 60 * 1000)

            const soon = await sessionRepository.findRunningSandboxes(owner.userId, in14)
            const later = await sessionRepository.findRunningSandboxes(owner.userId, in16)

            expect(soon.map((row) => row.id)).toEqual([starting.id])
            expect(later).toEqual([])
        })
    })

    describe('the daily archive job', () => {
        const DAY = 24 * 60 * 60 * 1000
        const now = new Date('2026-11-26T00:00:00.000Z')

        /** a session of the user that was last updated `days` days before `now` */
        const oldSession = async (
            userId: string,
            title: string,
            days: number,
            extra: Record<string, unknown> = {}
        ) => {
            const session = await prisma.session.create({ data: { userId, title, ...extra } })
            const updatedAt = new Date(now.getTime() - days * DAY)
            // raw SQL: prisma sets updatedAt to the current time on every write
            await prisma.$executeRaw`UPDATE "Session" SET "updatedAt" = ${updatedAt} WHERE "id" = ${session.id}`
            return session.id
        }

        const archivedTitles = async (userId: string) =>
            (
                await prisma.session.findMany({
                    where: { userId, isArchived: true },
                    select: { title: true },
                    orderBy: { title: 'asc' },
                })
            ).map((session) => session.title)

        beforeEach(async () => {
            await prisma.session.deleteMany({
                where: { userId: { in: [owner.userId, stranger.userId] } },
            })
        })

        afterAll(async () => {
            await prisma.session.deleteMany({
                where: { userId: { in: [owner.userId, stranger.userId] } },
            })
        })

        it('archives the sessions not updated for the days the user chose', async () => {
            await as(owner.token).patch('/setting/sandbox').send({ archiveAfterDays: 7 })
            const oldId = await oldSession(owner.userId, 'old', 8)
            await oldSession(owner.userId, 'recent', 6)
            await oldSession(owner.userId, 'pinned', 8, { pinnedAt: new Date() })
            await oldSession(owner.userId, 'running', 8, { sandboxStatus: 'RUNNING' })
            await oldSession(owner.userId, 'starting', 8, { sandboxStatus: 'STARTING' })
            await oldSession(owner.userId, 'paused', 8, { sandboxStatus: 'PAUSED' })
            // this user did not turn the archive on
            await oldSession(stranger.userId, 'not mine', 20)

            const result = await settingService.archiveInactiveSessions({ now })

            expect(result.users).toBeGreaterThanOrEqual(1)
            expect(await archivedTitles(owner.userId)).toEqual(['old', 'paused'])
            expect(await archivedTitles(stranger.userId)).toEqual([])
            // archived, not deleted, and the date of the last update stays
            expect(await prisma.session.count({ where: { userId: owner.userId } })).toBe(6)
            const old = await prisma.session.findUnique({ where: { id: oldId } })
            expect(old?.updatedAt.toISOString()).toBe('2026-11-18T00:00:00.000Z')
        })

        it('uses 30 days for a user who chose 30', async () => {
            await as(owner.token).patch('/setting/sandbox').send({ archiveAfterDays: 30 })
            await oldSession(owner.userId, 'day 29', 29)
            await oldSession(owner.userId, 'day 31', 31)

            await settingService.archiveInactiveSessions({ now })

            expect(await archivedTitles(owner.userId)).toEqual(['day 31'])
        })
    })
})
