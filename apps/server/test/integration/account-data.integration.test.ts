import zlib from 'zlib'

import { prisma } from '@december/database'
import { setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { ensureStorageBucket } from '../../src/config/s3'
import { emailService } from '../../src/modules/email/email.service'
import { setDataExportQueue } from '../../src/modules/setting/setting.queue'
import { settingService } from '../../src/modules/setting/setting.service'
import { getBinaryFile } from '../../src/shared/project-storage'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

/** the files of a zip made by buildZip, read from the local headers */
const readZip = (zip: Buffer): Record<string, string> => {
    const files: Record<string, string> = {}
    let offset = 0
    while (zip.readUInt32LE(offset) === 0x04034b50) {
        const compressedSize = zip.readUInt32LE(offset + 18)
        const nameLength = zip.readUInt16LE(offset + 26)
        const extraLength = zip.readUInt16LE(offset + 28)
        const nameStart = offset + 30
        const dataStart = nameStart + nameLength + extraLength
        const name = zip.subarray(nameStart, nameStart + nameLength).toString('utf8')
        const data = zip.subarray(dataStart, dataStart + compressedSize)
        files[name] = zlib.inflateRawSync(data).toString('utf8')
        offset = dataStart + compressedSize
    }
    return files
}

const authed = (token: string) => ({
    get: (path: string) =>
        request(app)
            .get(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object = {}) =>
        request(app)
            .post(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body),
    delete: (path: string, body?: object) => {
        const req = request(app)
            .delete(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
        return body ? req.send(body) : req
    },
})

/** the path and query of the download link in an export email */
const linkFrom = (body: string) => {
    const match = body.match(/https?:\/\/\S+\/api\/v1(\/setting\/export\/\S+)/)
    if (!match?.[1]) throw new Error(`no download link in: ${body}`)
    return match[1]
}

// #636 part 3: data export and delete all sessions
describe('account data api', () => {
    const stamp = Date.now()
    const savedSendMessage = emailService.sendMessageEmail
    const sentEmails: Array<{ to: string; subject: string; body: string }> = []
    const queuedExports: string[] = []
    const queuedJobs: Array<{ name: string; data: any }> = []
    const userIds: string[] = []

    beforeAll(async () => {
        await ensureStorageBucket()
        emailService.sendMessageEmail = (async (data: {
            to: string
            subject: string
            body: string
        }) => {
            sentEmails.push(data)
            return { id: `email-${sentEmails.length}` }
        }) as any
        setDataExportQueue({
            add: async (_name: string, data: { exportId: string }) => {
                queuedExports.push(data.exportId)
                return { id: `export-${queuedExports.length}` }
            },
        } as any)
        setAgentQueue({
            add: async (name: string, data: any) => {
                queuedJobs.push({ name, data })
                return { id: `job-${queuedJobs.length}` }
            },
        } as any)
    })

    afterAll(async () => {
        emailService.sendMessageEmail = savedSendMessage
        setDataExportQueue(null)
        setAgentQueue(null)
        await prisma.dataExport.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    describe('data export', () => {
        let user: { userId: string; token: string }
        let exportId: string
        let downloadPath: string

        beforeAll(async () => {
            user = await createSignedInUser({
                email: `export-${stamp}@example.com`,
                name: 'Export User',
            })
            userIds.push(user.userId)
            await prisma.session.create({
                data: {
                    userId: user.userId,
                    title: 'Fix the login page',
                    vmId: 'sandbox-secret-id',
                    createdAt: new Date(Date.now() - 60_000),
                    messages: {
                        create: [
                            { role: 'USER', content: 'the login page is blank', sequence: 1 },
                            { role: 'ASSISTANT', content: 'fixed the css', sequence: 2 },
                        ],
                    },
                },
            })
            await prisma.session.create({ data: { userId: user.userId, title: null } })
        })

        it('GET /setting/export is empty before the first export', async () => {
            const res = await authed(user.token).get('/setting/export')
            expect(res.status).toBe(200)
            expect(res.body.data.export).toBeNull()
        })

        it('POST /setting/export queues an export', async () => {
            const res = await authed(user.token).post('/setting/export')

            expect(res.status).toBe(202)
            exportId = res.body.data.export.id
            expect(res.body.data.export.status).toBe('PENDING')
            expect(queuedExports).toContain(exportId)

            const state = await authed(user.token).get('/setting/export')
            expect(state.body.data.export.id).toBe(exportId)
            const nextAllowed = new Date(state.body.data.export.nextAllowedAt).getTime()
            expect(nextAllowed).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000)
        })

        it('allows one export a day', async () => {
            const res = await authed(user.token).post('/setting/export')
            expect(res.status).toBe(429)
            expect(await prisma.dataExport.count({ where: { userId: user.userId } })).toBe(1)
        })

        it('the job builds the zip, stores it and emails a link', async () => {
            const result = await settingService.processDataExport({ exportId })
            expect(result).toMatchObject({ status: 'READY', sessions: 2 })

            const row = await prisma.dataExport.findUnique({ where: { id: exportId } })
            expect(row?.status).toBe('READY')
            expect(row?.fileKey).toBe(`exports/${user.userId}/${exportId}.zip`)
            expect(row?.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000)

            const email = sentEmails.find((sent) => sent.to === `export-${stamp}@example.com`)
            expect(email?.subject).toBe('Your December data export')
            downloadPath = linkFrom(email!.body)

            // a second run of the same job does nothing
            const again = await settingService.processDataExport({ exportId })
            expect(again).toEqual({ status: 'READY' })
        })

        it('the emailed link downloads the zip without signing in', async () => {
            const res = await request(app)
                .get(`/api/v1${downloadPath}`)
                .set('x-forwarded-for', getRandomIP())
                .buffer(true)
                .parse((response, callback) => {
                    const chunks: Buffer[] = []
                    response.on('data', (chunk: Buffer) => chunks.push(chunk))
                    response.on('end', () => callback(null, Buffer.concat(chunks)))
                })

            expect(res.status).toBe(200)
            expect(res.headers['content-type']).toBe('application/zip')
            expect(res.headers['content-disposition']).toMatch(
                /attachment; filename="december-export-\d{4}-\d{2}-\d{2}\.zip"/
            )

            const files = readZip(res.body as Buffer)
            expect(Object.keys(files).sort()).toEqual([
                'account.json',
                'sessions/0001-fix-the-login-page.json',
                'sessions/0002-session.json',
            ])
            const account = JSON.parse(files['account.json']!)
            expect(account.email).toBe(`export-${stamp}@example.com`)
            expect(account.otpHash).toBeUndefined()

            const session = JSON.parse(files['sessions/0001-fix-the-login-page.json']!)
            expect(session.title).toBe('Fix the login page')
            expect(session.messages.map((m: { content: string }) => m.content)).toEqual([
                'the login page is blank',
                'fixed the css',
            ])
            // sandbox internals are not part of the export
            expect(session.vmId).toBeUndefined()
        })

        it('a wrong token gets a small page, not the file', async () => {
            const res = await request(app)
                .get(`/api/v1/setting/export/${exportId}/download?t=wrong`)
                .set('x-forwarded-for', getRandomIP())
            expect(res.status).toBe(404)
            expect(res.headers['content-type']).toContain('text/html')
            expect(res.text).toContain('This download link is not valid')
        })

        it('the link ends when the export expires, and the sweep removes the file', async () => {
            await prisma.dataExport.update({
                where: { id: exportId },
                data: { expiresAt: new Date(Date.now() - 1000) },
            })
            const res = await request(app)
                .get(`/api/v1${downloadPath}`)
                .set('x-forwarded-for', getRandomIP())
            expect(res.status).toBe(410)

            const { deleted } = await settingService.purgeDataExports()
            expect(deleted).toBeGreaterThanOrEqual(1)
            expect(await prisma.dataExport.findUnique({ where: { id: exportId } })).toBeNull()
            expect(await getBinaryFile(`exports/${user.userId}/${exportId}.zip`)).toBeNull()
        })

        it('a failed export does not count toward the daily limit', async () => {
            const failed = await prisma.dataExport.create({
                data: { userId: user.userId, status: 'FAILED', error: 'storage was down' },
            })
            const state = await authed(user.token).get('/setting/export')
            expect(state.body.data.export.id).toBe(failed.id)
            expect(new Date(state.body.data.export.nextAllowedAt).getTime()).toBeLessThanOrEqual(
                Date.now()
            )

            const res = await authed(user.token).post('/setting/export')
            expect(res.status).toBe(202)
        })

        it('when the job cannot be queued, nothing is saved and the user can try again', async () => {
            const other = await createSignedInUser({ email: `export-fail-${stamp}@example.com` })
            userIds.push(other.userId)
            setDataExportQueue({
                add: async () => {
                    throw new Error('redis is down')
                },
            } as any)

            const res = await authed(other.token).post('/setting/export')
            expect(res.status).toBe(503)
            expect(await prisma.dataExport.count({ where: { userId: other.userId } })).toBe(0)

            setDataExportQueue({
                add: async (_name: string, data: { exportId: string }) => {
                    queuedExports.push(data.exportId)
                    return { id: 'export-retry' }
                },
            } as any)
            const retry = await authed(other.token).post('/setting/export')
            expect(retry.status).toBe(202)
        })
    })

    describe('delete all sessions', () => {
        let user: { userId: string; token: string }
        let other: { userId: string; token: string }
        let runningId: string
        let otherSessionId: string

        beforeAll(async () => {
            user = await createSignedInUser({ email: `delete-all-${stamp}@example.com` })
            other = await createSignedInUser({ email: `delete-all-other-${stamp}@example.com` })
            userIds.push(user.userId, other.userId)
        })

        beforeEach(async () => {
            queuedJobs.length = 0
            await prisma.session.deleteMany({ where: { userId: user.userId } })
            const running = await prisma.session.create({
                data: {
                    userId: user.userId,
                    title: 'running',
                    vmId: 'sbx-running',
                    sandboxStatus: 'RUNNING',
                    messages: { create: [{ role: 'USER', content: 'hi', sequence: 1 }] },
                },
            })
            runningId = running.id
            await prisma.session.create({
                data: {
                    userId: user.userId,
                    title: 'stopped',
                    vmId: 'sbx-stopped',
                    sandboxStatus: 'STOPPED',
                },
            })
            await prisma.session.create({ data: { userId: user.userId, title: 'no sandbox' } })
            if (!otherSessionId) {
                const kept = await prisma.session.create({
                    data: { userId: other.userId, title: 'keep me', vmId: 'sbx-other' },
                })
                otherSessionId = kept.id
            }
        })

        it('needs the typed confirm', async () => {
            const res = await authed(user.token).delete('/session')
            expect(res.status).toBe(400)

            const wrong = await authed(user.token).delete('/session', { confirm: 'yes' })
            expect(wrong.status).toBe(400)
            expect(await prisma.session.count({ where: { userId: user.userId } })).toBe(3)
        })

        it('stops the live sandboxes, then deletes every session of the user', async () => {
            const res = await authed(user.token).delete('/session', { confirm: 'delete' })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ deleted: 3, sandboxesStopped: 1 })
            expect(queuedJobs).toEqual([
                {
                    name: 'sandbox_control',
                    data: {
                        taskType: 'sandbox_control',
                        action: 'stop',
                        sessionId: runningId,
                        sandboxId: 'sbx-running',
                    },
                },
            ])
            expect(await prisma.session.count({ where: { userId: user.userId } })).toBe(0)
            expect(await prisma.message.count({ where: { sessionId: runningId } })).toBe(0)

            // another user's session stays
            expect(
                await prisma.session.findUnique({ where: { id: otherSessionId } })
            ).not.toBeNull()
        })

        it('deletes nothing when the sandbox stops cannot be queued', async () => {
            setAgentQueue({
                add: async () => {
                    throw new Error('redis is down')
                },
            } as any)
            try {
                const res = await authed(user.token).delete('/session', { confirm: 'delete' })
                expect(res.status).toBe(503)
                expect(await prisma.session.count({ where: { userId: user.userId } })).toBe(3)
            } finally {
                setAgentQueue({
                    add: async (name: string, data: any) => {
                        queuedJobs.push({ name, data })
                        return { id: `job-${queuedJobs.length}` }
                    },
                } as any)
            }
        })

        it('works when there is nothing to delete', async () => {
            await prisma.session.deleteMany({ where: { userId: user.userId } })
            const res = await authed(user.token).delete('/session', { confirm: 'delete' })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ deleted: 0, sandboxesStopped: 0 })
        })
    })
})
