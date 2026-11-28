import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { ensureStorageBucket } from '../../src/config/s3'
import { attachmentService } from '../../src/modules/attachment/attachment.service'
import { sessionService } from '../../src/modules/session/session.service'
import {
    getBinaryFile,
    getTextFile,
    putTextFile,
    sessionAssetKey,
    sessionWorkspaceKey,
} from '../../src/shared/project-storage'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// the smallest files that pass the checks of the bytes
const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('rest of the picture'),
])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jfif data')])

// #634: files sent with a prompt
describe('prompt attachments', () => {
    const stamp = Date.now()

    let owner: { userId: string; token: string }
    let stranger: { userId: string; token: string }
    let sessionId: string

    const upload = (token: string, session: string, name: string, body: Buffer) =>
        request(app)
            .post(`/api/v1/session/${session}/attachments`)
            .query({ name })
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'application/octet-stream')
            .send(body)

    beforeAll(async () => {
        await ensureStorageBucket()
        owner = await createSignedInUser({ email: `attachment-${stamp}@example.com` })
        stranger = await createSignedInUser({ email: `attachment-other-${stamp}@example.com` })
        const session = await prisma.session.create({
            data: { userId: owner.userId, title: 'attachments' },
        })
        sessionId = session.id
    })

    afterAll(async () => {
        const ids = [owner.userId, stranger.userId]
        await prisma.session.deleteMany({ where: { userId: { in: ids } } })
        for (const id of ids) {
            await cleanupTestUser({ id })
        }
    })

    describe('upload', () => {
        it('stores a text file of the session and answers its id, name, type and size', async () => {
            const res = await upload(owner.token, sessionId, 'notes.txt', Buffer.from('hello'))

            expect(res.status).toBe(201)
            const { attachment } = res.body.data
            expect(attachment.id).toMatch(/^[0-9a-f-]{36}$/)
            expect(attachment.name).toBe('notes.txt')
            expect(attachment.contentType).toBe('text/plain')
            expect(attachment.sizeBytes).toBe(5)
            // the place in the file store stays on the server
            expect(attachment.fileKey).toBeUndefined()

            const row = await prisma.messageAttachment.findUnique({ where: { id: attachment.id } })
            expect(row?.sessionId).toBe(sessionId)
            expect(row?.messageId).toBeNull()
            expect(row?.fileKey).toBe(
                `sessions/${sessionId}/attachments/${attachment.id}/notes.txt`
            )
            const stored = await getBinaryFile(row!.fileKey)
            expect(Buffer.from(stored!.body).toString('utf8')).toBe('hello')
        })

        it('stores an image and takes its type from the bytes', async () => {
            // the name says jpg, the bytes are a png
            const res = await upload(owner.token, sessionId, 'shot.jpg', PNG)

            expect(res.status).toBe(201)
            expect(res.body.data.attachment.name).toBe('shot.jpg')
            expect(res.body.data.attachment.contentType).toBe('image/png')
            expect(res.body.data.attachment.sizeBytes).toBe(PNG.length)

            const jpeg = await upload(owner.token, sessionId, 'photo.jpeg', JPEG)
            expect(jpeg.status).toBe(201)
            expect(jpeg.body.data.attachment.contentType).toBe('image/jpeg')
        })

        it('makes the file name safe', async () => {
            const res = await upload(
                owner.token,
                sessionId,
                '../../.git/hooks/pre commit.sh',
                Buffer.from('echo hi')
            )

            expect(res.status).toBe(201)
            expect(res.body.data.attachment.name).toBe('pre_commit.sh')
            const row = await prisma.messageAttachment.findUnique({
                where: { id: res.body.data.attachment.id },
            })
            expect(row?.fileKey).toBe(`sessions/${sessionId}/attachments/${row?.id}/pre_commit.sh`)
        })
    })

    describe('refused uploads', () => {
        const countRows = () => prisma.messageAttachment.count({ where: { sessionId } })

        it('refuses a file over 5 MB', async () => {
            const before = await countRows()
            // supertest under bun does not finish a body of this size, so this request
            // goes to a listening server
            const server = app.listen(0)
            try {
                const { port } = server.address() as { port: number }
                const send = (size: number) =>
                    fetch(
                        `http://127.0.0.1:${port}/api/v1/session/${sessionId}/attachments?name=big.txt`,
                        {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${owner.token}`,
                                'Content-Type': 'application/octet-stream',
                                'x-forwarded-for': getRandomIP(),
                            },
                            body: Buffer.alloc(size, 'a'),
                        }
                    )

                const tooLarge = await send(5 * 1024 * 1024 + 1)
                expect(tooLarge.status).toBe(413)
                expect(((await tooLarge.json()) as { message: string }).message).toBe(
                    'the file is larger than 5 MB'
                )
                expect(await countRows()).toBe(before)

                // exactly 5 MB is allowed
                const atTheCap = await send(5 * 1024 * 1024)
                expect(atTheCap.status).toBe(201)
            } finally {
                server.close()
            }
        })

        it('refuses a type that is not an image or a text file', async () => {
            const res = await upload(owner.token, sessionId, 'report.pdf', Buffer.from('%PDF-1.7'))

            expect(res.status).toBe(415)
            expect(res.body.message).toBe(
                'this file type is not allowed. send an image or a text file'
            )
        })

        it('refuses bytes that do not match the name', async () => {
            // a program with a picture name, and a picture with a text name
            const program = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
            expect((await upload(owner.token, sessionId, 'shot.png', program)).status).toBe(415)
            expect((await upload(owner.token, sessionId, 'notes.txt', program)).status).toBe(415)
        })

        it('refuses an empty file', async () => {
            const res = await upload(owner.token, sessionId, 'notes.txt', Buffer.alloc(0))

            expect(res.status).toBe(400)
        })

        it('answers 404 for a session of another user, and stores nothing', async () => {
            const before = await countRows()
            const res = await upload(stranger.token, sessionId, 'notes.txt', Buffer.from('hello'))

            expect(res.status).toBe(404)
            expect(res.body.message).toBe('Session not found')
            expect(await countRows()).toBe(before)
        })

        it('answers 401 without a sign-in', async () => {
            const res = await request(app)
                .post(`/api/v1/session/${sessionId}/attachments`)
                .query({ name: 'notes.txt' })
                .set('x-forwarded-for', getRandomIP())
                .set('Content-Type', 'application/octet-stream')
                .send(Buffer.from('hello'))

            expect(res.status).toBe(401)
        })

        it('refuses a file when the session has 50 MB of files', async () => {
            const full = await prisma.session.create({
                data: { userId: owner.userId, title: 'full' },
            })
            await prisma.messageAttachment.create({
                data: {
                    sessionId: full.id,
                    name: 'old.txt',
                    contentType: 'text/plain',
                    sizeBytes: 50 * 1024 * 1024 - 4,
                    fileKey: `sessions/${full.id}/attachments/old/old.txt`,
                },
            })

            // 4 bytes still fit, 5 bytes do not
            expect(
                (await upload(owner.token, full.id, 'more.txt', Buffer.from('hello'))).status
            ).toBe(413)
            expect(
                (await upload(owner.token, full.id, 'more.txt', Buffer.from('hell'))).status
            ).toBe(201)
        })
    })

    describe('a prompt with files', () => {
        const get = (token: string, path: string) =>
            request(app)
                .get(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)

        const newSession = async (userId: string) =>
            (await prisma.session.create({ data: { userId, title: 'prompt files' } })).id

        const uploadId = async (token: string, session: string, name: string, body: Buffer) => {
            const res = await upload(token, session, name, body)
            expect(res.status).toBe(201)
            return res.body.data.attachment.id as string
        }

        it('gives the worker job the files of the prompt, and saves them with the message', async () => {
            const session = await newSession(owner.userId)
            const notes = await uploadId(owner.token, session, 'notes.txt', Buffer.from('hello'))
            const shot = await uploadId(owner.token, session, 'shot.png', PNG)

            const sequence = await sessionService.recordUserPrompt({
                userId: owner.userId,
                sessionId: session,
                prompt: 'read these',
            })
            const jobFiles = await attachmentService.attachToPrompt({
                userId: owner.userId,
                sessionId: session,
                attachmentIds: [notes, shot],
                sequence,
            })

            expect(jobFiles).toEqual([
                {
                    id: notes,
                    name: 'notes.txt',
                    key: `sessions/${session}/attachments/${notes}/notes.txt`,
                    contentType: 'text/plain',
                    sizeBytes: 5,
                },
                {
                    id: shot,
                    name: 'shot.png',
                    key: `sessions/${session}/attachments/${shot}/shot.png`,
                    contentType: 'image/png',
                    sizeBytes: PNG.length,
                },
            ])

            // after a reload the chat reads the names from the session
            const detail = await get(owner.token, `/session/${session}`)
            expect(detail.status).toBe(200)
            const userMessage = detail.body.data.chatMessages.find(
                (message: { role: string }) => message.role === 'USER'
            )
            expect(userMessage.content).toBe('read these')
            expect(userMessage.attachments).toEqual([
                { id: notes, name: 'notes.txt', contentType: 'text/plain', sizeBytes: 5 },
                { id: shot, name: 'shot.png', contentType: 'image/png', sizeBytes: PNG.length },
            ])

            const page = await get(owner.token, `/session/${session}/messages`)
            expect(page.status).toBe(200)
            expect(
                page.body.data.messages[0].attachments.map((file: { name: string }) => file.name)
            ).toEqual(['notes.txt', 'shot.png'])
        })

        it('sends a file with one prompt only', async () => {
            const session = await newSession(owner.userId)
            const notes = await uploadId(owner.token, session, 'notes.txt', Buffer.from('hello'))
            const first = await sessionService.recordUserPrompt({
                userId: owner.userId,
                sessionId: session,
                prompt: 'first',
            })
            const taken = await attachmentService.attachToPrompt({
                userId: owner.userId,
                sessionId: session,
                attachmentIds: [notes],
                sequence: first,
            })
            expect(taken.map((file) => file.id)).toEqual([notes])

            await prisma.message.create({
                data: { sessionId: session, role: 'ASSISTANT', content: 'done', sequence: 2 },
            })
            const second = await sessionService.recordUserPrompt({
                userId: owner.userId,
                sessionId: session,
                prompt: 'second',
            })
            const again = await attachmentService.attachToPrompt({
                userId: owner.userId,
                sessionId: session,
                attachmentIds: [notes],
                sequence: second,
            })
            expect(again).toEqual([])
        })

        it('leaves out ids of another session or another user, and unknown ids', async () => {
            const mine = await newSession(owner.userId)
            const otherOfMine = await newSession(owner.userId)
            const theirs = await newSession(stranger.userId)
            const fromOtherSession = await uploadId(
                owner.token,
                otherOfMine,
                'other.txt',
                Buffer.from('other')
            )
            const fromStranger = await uploadId(
                stranger.token,
                theirs,
                'secret.txt',
                Buffer.from('secret')
            )
            const own = await uploadId(owner.token, mine, 'own.txt', Buffer.from('own'))

            const sequence = await sessionService.recordUserPrompt({
                userId: owner.userId,
                sessionId: mine,
                prompt: 'take them all',
            })
            const jobFiles = await attachmentService.attachToPrompt({
                userId: owner.userId,
                sessionId: mine,
                attachmentIds: [fromOtherSession, fromStranger, 'not-an-id', own],
                sequence,
            })
            expect(jobFiles.map((file) => file.name)).toEqual(['own.txt'])

            // the stranger cannot take the owner's file with its id either
            const strangerSequence = await sessionService.recordUserPrompt({
                userId: stranger.userId,
                sessionId: theirs,
                prompt: 'mine now',
            })
            const stolen = await attachmentService.attachToPrompt({
                userId: stranger.userId,
                sessionId: mine,
                attachmentIds: [fromOtherSession],
                sequence: strangerSequence,
            })
            expect(stolen).toEqual([])
            const untouched = await prisma.messageAttachment.findUnique({
                where: { id: fromStranger },
            })
            expect(untouched?.messageId).toBeNull()
        })

        it('takes 5 files for one prompt', async () => {
            const session = await newSession(owner.userId)
            const ids: string[] = []
            for (let index = 0; index < 6; index++) {
                ids.push(
                    await uploadId(owner.token, session, `file-${index}.txt`, Buffer.from('x'))
                )
            }
            const sequence = await sessionService.recordUserPrompt({
                userId: owner.userId,
                sessionId: session,
                prompt: 'six files',
            })
            const jobFiles = await attachmentService.attachToPrompt({
                userId: owner.userId,
                sessionId: session,
                attachmentIds: ids,
                sequence,
            })
            expect(jobFiles.map((file) => file.name)).toEqual([
                'file-0.txt',
                'file-1.txt',
                'file-2.txt',
                'file-3.txt',
                'file-4.txt',
            ])
        })
    })

    // review A3: a chip the user removes, or a batch with a refused file, gives its room back
    describe('remove a waiting file', () => {
        const remove = (token: string, session: string, attachmentId: string) =>
            request(app)
                .delete(`/api/v1/session/${session}/attachments/${attachmentId}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)

        const waitingFile = async () => {
            const session = await prisma.session.create({
                data: { userId: owner.userId, title: 'remove a file' },
            })
            const res = await upload(owner.token, session.id, 'notes.txt', Buffer.from('hello'))
            expect(res.status).toBe(201)
            const id = res.body.data.attachment.id as string
            return {
                session: session.id,
                id,
                key: `sessions/${session.id}/attachments/${id}/notes.txt`,
            }
        }

        it('removes the row and the stored bytes of a file no message has', async () => {
            const file = await waitingFile()

            const res = await remove(owner.token, file.session, file.id)

            expect(res.status).toBe(200)
            expect(res.body.message).toBe('attachment removed successfully')
            expect(await prisma.messageAttachment.findUnique({ where: { id: file.id } })).toBeNull()
            expect(await getBinaryFile(file.key)).toBeNull()
        })

        it('answers 404 to another user, and keeps the file', async () => {
            const file = await waitingFile()

            const res = await remove(stranger.token, file.session, file.id)

            expect(res.status).toBe(404)
            expect(
                await prisma.messageAttachment.findUnique({ where: { id: file.id } })
            ).not.toBeNull()
            expect(await getBinaryFile(file.key)).not.toBeNull()
        })

        it('answers 404 for a file of another session', async () => {
            const file = await waitingFile()
            const other = await waitingFile()

            const res = await remove(owner.token, other.session, file.id)

            expect(res.status).toBe(404)
            expect(
                await prisma.messageAttachment.findUnique({ where: { id: file.id } })
            ).not.toBeNull()
        })

        it('refuses a file that a message already has', async () => {
            const file = await waitingFile()
            const sequence = await sessionService.recordUserPrompt({
                userId: owner.userId,
                sessionId: file.session,
                prompt: 'read this',
            })
            await attachmentService.attachToPrompt({
                userId: owner.userId,
                sessionId: file.session,
                attachmentIds: [file.id],
                sequence,
            })

            const res = await remove(owner.token, file.session, file.id)

            expect(res.status).toBe(409)
            expect(res.body.message).toBe('this file is part of a sent message')
            expect(await getBinaryFile(file.key)).not.toBeNull()
        })

        it('answers 401 with no sign-in and 400 for an id that is not valid', async () => {
            const file = await waitingFile()

            const anonymous = await request(app)
                .delete(`/api/v1/session/${file.session}/attachments/${file.id}`)
                .set('x-forwarded-for', getRandomIP())
            expect(anonymous.status).toBe(401)

            const badId = await remove(owner.token, file.session, 'not-an-id')
            expect(badId.status).toBe(400)
        })
    })

    describe('clean up', () => {
        const del = (token: string, path: string) =>
            request(app)
                .delete(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)

        /** a session with one stored file; gives the session id and the key of the file */
        const sessionWithFile = async (token: string, userId: string, updatedAt?: Date) => {
            const session = await prisma.session.create({
                data: { userId, title: 'to delete', ...(updatedAt ? { updatedAt } : {}) },
            })
            const res = await upload(token, session.id, 'notes.txt', Buffer.from('hello'))
            const key = `sessions/${session.id}/attachments/${res.body.data.attachment.id}/notes.txt`
            expect(await getBinaryFile(key)).not.toBeNull()
            return { id: session.id, key }
        }

        it('deleting a session removes its files and their rows', async () => {
            const session = await sessionWithFile(owner.token, owner.userId)

            const res = await del(owner.token, `/session/${session.id}`)

            expect(res.status).toBe(200)
            expect(await getBinaryFile(session.key)).toBeNull()
            expect(await prisma.messageAttachment.count({ where: { sessionId: session.id } })).toBe(
                0
            )
        })

        it('deleting all sessions removes the files of each one', async () => {
            const first = await sessionWithFile(stranger.token, stranger.userId)
            const second = await sessionWithFile(stranger.token, stranger.userId)
            const kept = await sessionWithFile(owner.token, owner.userId)

            const res = await del(stranger.token, '/session').send({ confirm: 'delete' })

            expect(res.status).toBe(200)
            expect(await getBinaryFile(first.key)).toBeNull()
            expect(await getBinaryFile(second.key)).toBeNull()
            // another user's files stay
            expect(await getBinaryFile(kept.key)).not.toBeNull()
        })

        it('the daily sweep deletes old sessions with all their files, and keeps recent ones', async () => {
            const oldDate = new Date('2026-01-01T00:00:00.000Z')
            const old = await sessionWithFile(owner.token, owner.userId, oldDate)
            const recent = await sessionWithFile(owner.token, owner.userId)
            // files outside attachments: the workspace and the assets of the session
            const workspaceKey = sessionWorkspaceKey(old.id, 'src/app.ts')
            const assetKey = sessionAssetKey(old.id, 'logo.png')
            await putTextFile({ key: workspaceKey, content: 'export {}' })
            await putTextFile({ key: assetKey, content: 'png' })
            const recentWorkspace = sessionWorkspaceKey(recent.id, 'src/app.ts')
            await putTextFile({ key: recentWorkspace, content: 'export {}' })
            // the upload may touch the row: put the old date back
            await prisma.session.update({ where: { id: old.id }, data: { updatedAt: oldDate } })

            const result = await sessionService.purgeExpiredSessions({
                before: new Date('2026-02-01T00:00:00.000Z'),
            })

            expect(result.deleted).toBeGreaterThanOrEqual(1)
            expect(await prisma.session.findUnique({ where: { id: old.id } })).toBeNull()
            expect(await getBinaryFile(old.key)).toBeNull()
            expect(await getTextFile(workspaceKey)).toBeNull()
            expect(await getTextFile(assetKey)).toBeNull()

            expect(await prisma.session.findUnique({ where: { id: recent.id } })).not.toBeNull()
            expect(await getBinaryFile(recent.key)).not.toBeNull()
            expect(await getTextFile(recentWorkspace)).not.toBeNull()
        })

        it('the daily sweep works in batches', async () => {
            const oldDate = new Date('2026-01-02T00:00:00.000Z')
            const ids: string[] = []
            for (let i = 0; i < 5; i += 1) {
                const session = await prisma.session.create({
                    data: { userId: owner.userId, title: `old ${i}`, updatedAt: oldDate },
                })
                ids.push(session.id)
            }
            const result = await sessionService.purgeExpiredSessions({
                before: new Date('2026-02-01T00:00:00.000Z'),
                batchSize: 2,
            })
            expect(result.deleted).toBeGreaterThanOrEqual(5)
            expect(await prisma.session.count({ where: { id: { in: ids } } })).toBe(0)
        })
    })
})
