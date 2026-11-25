import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { settingService } from '../../src/modules/setting/setting.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// #637 section 4: the sandbox settings of a user and the setup commands of a repository
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
        await prisma.repositorySetting.deleteMany({ where: { userId: { in: ids } } })
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
        it('starts on 10 minutes idle, no archive and no setup commands', async () => {
            const res = await as(owner.token).get('/setting/sandbox')

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                idleStopMinutes: 10,
                archiveAfterDays: null,
                setupCommands: [],
            })
        })

        it('needs a signed in user', async () => {
            const res = await request(app)
                .get('/api/v1/setting/sandbox')
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(401)
        })
    })

    describe('PATCH /setting/sandbox', () => {
        it('saves the idle time and answers with all the settings', async () => {
            const saved = await as(owner.token)
                .patch('/setting/sandbox')
                .send({ idleStopMinutes: 30 })

            expect(saved.status).toBe(200)
            expect(saved.body.data).toEqual({
                idleStopMinutes: 30,
                archiveAfterDays: null,
                setupCommands: [],
            })

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

        it('refuses a value that is not a choice, and saves nothing', async () => {
            const bodies = [
                { idleStopMinutes: 15 },
                { idleStopMinutes: '30' },
                { archiveAfterDays: 14 },
                { machineSize: 'large' },
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

    describe('PUT /setting/sandbox/setup-commands', () => {
        it('saves the commands of a repository, and the settings list them', async () => {
            const saved = await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'Acme/Web', commands: 'bun install\r\nbun run build\n\n' })

            expect(saved.status).toBe(200)
            expect(saved.body.data.setupCommands).toEqual([
                { repoFullName: 'acme/web', commands: 'bun install\nbun run build' },
            ])

            const read = await as(owner.token).get('/setting/sandbox')
            expect(read.body.data.setupCommands).toEqual([
                { repoFullName: 'acme/web', commands: 'bun install\nbun run build' },
            ])
            // a repository setting belongs to one user
            const other = await as(stranger.token).get('/setting/sandbox')
            expect(other.body.data.setupCommands).toEqual([])
        })

        it('replaces the commands of the same repository', async () => {
            await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'acme/web', commands: 'npm ci' })
            await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'acme/api', commands: 'make deps' })
            const saved = await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'acme/web', commands: 'pnpm install' })

            expect(saved.body.data.setupCommands).toEqual([
                { repoFullName: 'acme/api', commands: 'make deps' },
                { repoFullName: 'acme/web', commands: 'pnpm install' },
            ])
        })

        it('removes the row when the text is empty', async () => {
            await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'acme/web', commands: 'npm ci' })
            const cleared = await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'acme/web', commands: '  \n ' })

            expect(cleared.status).toBe(200)
            expect(cleared.body.data.setupCommands).toEqual([])
            expect(await prisma.repositorySetting.count({ where: { userId: owner.userId } })).toBe(
                0
            )
        })

        it('refuses a text over 4000 characters and a name that is not a repository', async () => {
            const tooLong = await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'acme/web', commands: 'x'.repeat(4001) })
            expect(tooLong.status).toBe(400)

            const longest = await as(owner.token)
                .put('/setting/sandbox/setup-commands')
                .send({ repoFullName: 'acme/web', commands: 'x'.repeat(4000) })
            expect(longest.status).toBe(200)

            for (const repoFullName of ['web', 'acme/web; rm -rf /', '', '../x', 'acme/..']) {
                const res = await as(owner.token)
                    .put('/setting/sandbox/setup-commands')
                    .send({ repoFullName, commands: 'npm ci' })
                expect(res.status).toBe(400)
            }
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
