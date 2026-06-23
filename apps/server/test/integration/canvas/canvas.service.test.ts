import * as childProcess from 'child_process'
import * as fsPromises from 'fs/promises'

import { prisma } from '@december/database'
import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'

const spawnMock = mock((command: string, args: string[], options: any) => {
    return {
        stdout: {
            setEncoding: () => {},
            on: (event: string, callback: any) => {
                if (event === 'data') {
                    const mockResult = {
                        directory: '/tmp/test-clip-dir',
                        full: '/tmp/test-clip-dir/full.png',
                        width: 1024,
                        height: 768,
                        sections: [
                            {
                                path: '/tmp/test-clip-dir/section-1.png',
                                width: 1024,
                                height: 768,
                            },
                        ],
                    }
                    callback(JSON.stringify(mockResult) + '\n')
                }
            },
        },
        stderr: {
            setEncoding: () => {},
            on: () => {},
        },
        on: (event: string, callback: any) => {
            if (event === 'close') {
                callback(0)
            }
        },
        kill: () => {},
    } as any
})

mock.module('child_process', () => ({
    ...childProcess,
    spawn: spawnMock,
}))

const readFileMock = mock(async () => Buffer.from('mock-image-data'))
const rmMock = mock(async () => {})

mock.module('fs/promises', () => ({
    ...fsPromises,
    readFile: readFileMock,
    rm: rmMock,
}))

const putBinaryFileMock = mock(async () => {})

mock.module('../../../src/shared/project-storage', () => ({
    assetKey: (projectId: string, assetPath: string) => `projects/${projectId}/assets/${assetPath}`,
    temporaryCanvasAssetKey: (userId: string, assetPath: string) =>
        `users/${userId}/canvas-temp/${assetPath}`,
    putBinaryFile: putBinaryFileMock,
}))

import { canvasService } from '../../../src/modules/canvas/canvas.service'

describe('canvas.service.integration', () => {
    let user: any
    let project: any

    beforeEach(async () => {
        spawnMock.mockClear()
        readFileMock.mockClear()
        rmMock.mockClear()
        putBinaryFileMock.mockClear()

        await prisma.projectVersion.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        user = await prisma.user.create({
            data: {
                name: 'Test User',
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
                emailVerified: true,
            },
        })

        project = await prisma.project.create({
            data: {
                name: 'Test Project',
                userId: user.id,
                prompt: 'test prompt',
            },
        })

        const version = await prisma.projectVersion.create({
            data: {
                versionNumber: 1,
                projectId: project.id,
                status: 'READY',
                sourcePrompt: 'initial prompt',
                objectStoragePrefix: `projects/${project.id}/v1/`,
                manifestJson: [],
            },
        })

        await prisma.project.update({
            where: { id: project.id },
            data: { currentVersionId: version.id },
        })
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('saveCanvas', () => {
        it('should successfully save canvas state to current project version', async () => {
            const canvasState = {
                items: [],
                connections: [],
                pan: { x: 5, y: 5 },
                scale: 150,
                hasInteracted: true,
            }

            const result = await canvasService.saveCanvas({
                projectId: project.id,
                userId: user.id,
                canvasState,
            })

            expect(result.success).toBe(true)
            expect(result.canvasState).toEqual(canvasState)

            // Verify db version update
            const dbProject = await prisma.project.findUnique({
                where: { id: project.id },
                select: { currentVersionId: true },
            })
            const version = await prisma.projectVersion.findUnique({
                where: { id: dbProject!.currentVersionId! },
            })
            expect(version!.canvasStateJson).toEqual(canvasState)
        })

        it('should throw project not found if project ID does not match userId', async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: 'other@example.com',
                    username: 'other',
                    password: 'password123',
                    emailVerified: true,
                },
            })

            let error: any = null
            try {
                await canvasService.saveCanvas({
                    projectId: project.id,
                    userId: otherUser.id,
                    canvasState: {},
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('project not found')
        })
    })

    describe('createWebClips', () => {
        it('should execute clipper worker and return clips data', async () => {
            const result = await canvasService.createWebClips({
                url: 'https://google.com',
                userId: user.id,
                projectId: project.id,
            })

            expect(result.sourceUrl).toBe('https://google.com')
            expect(result.clips.length).toBe(1)
            expect(result.clips[0].content).toContain('data:image/png;base64,')
            expect(result.clips[0].assetKind).toBe('web-clip')
            expect(result.clips[0].width).toBe(1024)
            expect(result.clips[0].height).toBe(768)

            expect(spawnMock).toHaveBeenCalledTimes(1)
            expect(readFileMock).toHaveBeenCalledTimes(1)
            expect(putBinaryFileMock).toHaveBeenCalledTimes(1)
        })

        it('should throw project not found when using unauthorized projectId', async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: 'other@example.com',
                    username: 'other',
                    password: 'password123',
                    emailVerified: true,
                },
            })

            let error: any = null
            try {
                await canvasService.createWebClips({
                    url: 'https://google.com',
                    userId: otherUser.id,
                    projectId: project.id,
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('project not found')
        })
    })
})
