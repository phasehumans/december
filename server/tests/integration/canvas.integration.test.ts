import * as cryptoModule from 'crypto'
import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'

import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

import { prisma } from '../../src/config/db'

type StoredUpload = {
    key: string
    content: Buffer
    contentType?: string
}

type WorkerScenario = {
    error?: Error
    stderr?: string
    result?: {
        directory: string
        full: string
        width: number
        height: number
        sections: Array<{
            path: string
            width: number
            height: number
        }>
    }
    code?: number
}

const clipFiles = new Map<string, Buffer>()
const uploadedFiles: StoredUpload[] = []
const workerScenarios: WorkerScenario[] = []
let putBinaryFileError: Error | null = null
let emailCounter = 0

const putBinaryFileMock = mock(
    async ({
        key,
        content,
        contentType,
    }: {
        key: string
        content: Uint8Array | Buffer
        contentType?: string
    }) => {
        if (putBinaryFileError) {
            throw putBinaryFileError
        }

        uploadedFiles.push({
            key,
            content: Buffer.from(content),
            ...(contentType ? { contentType } : {}),
        })
    }
)

const readFileMock = mock(async (filePath: string) => {
    const buffer = clipFiles.get(filePath)

    if (!buffer) {
        throw new Error(`missing clip file: ${filePath}`)
    }

    return buffer
})

const rmMock = mock(
    async (_target: string, _options?: { recursive?: boolean; force?: boolean }) => {}
)

const spawnMock = mock((_command: string, _args: string[], _options: unknown) => {
    const scenario = workerScenarios.shift()

    if (!scenario) {
        throw new Error('missing worker scenario')
    }

    const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter & { setEncoding: (_encoding: string) => void }
        stderr: EventEmitter & { setEncoding: (_encoding: string) => void }
        kill: () => void
    }

    child.stdout = Object.assign(new EventEmitter(), {
        setEncoding: (_encoding: string) => {},
    })
    child.stderr = Object.assign(new EventEmitter(), {
        setEncoding: (_encoding: string) => {},
    })
    child.kill = () => {}

    queueMicrotask(() => {
        if (scenario.error) {
            child.emit('error', scenario.error)
            return
        }

        if (scenario.result) {
            child.stdout.emit('data', `${JSON.stringify(scenario.result)}\n`)
        }

        if (scenario.stderr) {
            child.stderr.emit('data', scenario.stderr)
        }

        child.emit('close', scenario.code ?? 0)
    })

    return child
})

mock.module('crypto', () => ({
    ...cryptoModule,
    randomUUID: () => 'clip-batch-1',
}))

mock.module('child_process', () => ({
    spawn: spawnMock,
}))

mock.module('fs/promises', () => ({
    readFile: readFileMock,
    rm: rmMock,
}))

mock.module('../../src/lib/project-storage', () => ({
    assetKey: (projectId: string, assetPath: string) =>
        `projects/${projectId}/assets/${assetPath.replace(/^\/+/, '')}`,
    temporaryCanvasAssetKey: (userId: string, assetPath: string) =>
        `users/${userId}/canvas-temp/${assetPath.replace(/^\/+/, '')}`,
    putBinaryFile: putBinaryFileMock,
}))

const { canvasService } = await import('../../src/modules/canvas/canvas.service')

const queueWorkerSuccess = (data: WorkerScenario['result']) => {
    workerScenarios.push({
        result: data,
        code: 0,
    })
}

const createUser = async () => {
    emailCounter += 1

    return prisma.user.create({
        data: {
            name: `Canvas User ${emailCounter}`,
            email: `canvas-user-${emailCounter}@example.com`,
            username: `canvasuser${emailCounter}`,
            emailVerified: true,
        },
    })
}

const createProject = async (userId: string) => {
    return prisma.project.create({
        data: {
            name: 'Canvas Project',
            description: 'canvas integration test project',
            prompt: 'build a canvas project',
            userId,
        },
    })
}

describe('canvasService integration', () => {
    beforeEach(async () => {
        await prisma.projectMessage.deleteMany().catch(() => undefined)
        await prisma.projectVersion.deleteMany().catch(() => undefined)
        await prisma.project.deleteMany()
        await prisma.user.deleteMany()

        clipFiles.clear()
        uploadedFiles.length = 0
        workerScenarios.length = 0
        putBinaryFileError = null
        putBinaryFileMock.mockClear()
        readFileMock.mockClear()
        rmMock.mockClear()
        spawnMock.mockClear()
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it('stores temporary web clips when no project id is provided', async () => {
        const user = await createUser()
        const clipDirectory = path.join(os.tmpdir(), 'phasehumans-web-clips', 'temp-batch')
        const firstClipPath = path.join(clipDirectory, 'section-1.png')
        const secondClipPath = path.join(clipDirectory, 'section-2.png')

        clipFiles.set(firstClipPath, Buffer.from('first-clip'))
        clipFiles.set(secondClipPath, Buffer.from('second-clip'))
        queueWorkerSuccess({
            directory: clipDirectory,
            full: path.join(clipDirectory, 'full.png'),
            width: 1200,
            height: 900,
            sections: [
                {
                    path: firstClipPath,
                    width: 800,
                    height: 400,
                },
                {
                    path: secondClipPath,
                    width: 800,
                    height: 500,
                },
            ],
        })

        const result = await canvasService.createWebClips({
            url: 'https://Docs.Example.com/article',
            userId: user.id,
        })

        expect(result).toEqual({
            sourceUrl: 'https://Docs.Example.com/article',
            clips: [
                {
                    id: 'clip-batch-1-1',
                    content: 'data:image/png;base64,Zmlyc3QtY2xpcA==',
                    width: 800,
                    height: 400,
                    assetKey: `users/${user.id}/canvas-temp/web-clips/docs-example-com/clip-batch-1/section-1.png`,
                    assetSource: 'temporary',
                    assetContentType: 'image/png',
                    assetKind: 'web-clip',
                },
                {
                    id: 'clip-batch-1-2',
                    content: 'data:image/png;base64,c2Vjb25kLWNsaXA=',
                    width: 800,
                    height: 500,
                    assetKey: `users/${user.id}/canvas-temp/web-clips/docs-example-com/clip-batch-1/section-2.png`,
                    assetSource: 'temporary',
                    assetContentType: 'image/png',
                    assetKind: 'web-clip',
                },
            ],
        })
        expect(putBinaryFileMock).toHaveBeenCalledTimes(2)
        expect(spawnMock).toHaveBeenCalledTimes(1)
        expect(rmMock).toHaveBeenCalledWith(clipDirectory, {
            recursive: true,
            force: true,
        })
    })

    it('stores project web clips when the project belongs to the user', async () => {
        const user = await createUser()
        const project = await createProject(user.id)
        const clipDirectory = path.join(os.tmpdir(), 'phasehumans-web-clips', 'project-batch')
        const clipPath = path.join(clipDirectory, 'section-1.png')

        clipFiles.set(clipPath, Buffer.from('project-clip'))
        queueWorkerSuccess({
            directory: clipDirectory,
            full: path.join(clipDirectory, 'full.png'),
            width: 640,
            height: 480,
            sections: [
                {
                    path: clipPath,
                    width: 640,
                    height: 480,
                },
            ],
        })

        const result = await canvasService.createWebClips({
            url: 'https://example.com/path',
            userId: user.id,
            projectId: project.id,
        })

        expect(result.clips).toEqual([
            {
                id: 'clip-batch-1-1',
                content: 'data:image/png;base64,cHJvamVjdC1jbGlw',
                width: 640,
                height: 480,
                assetKey: `projects/${project.id}/assets/web-clips/example-com/clip-batch-1/section-1.png`,
                assetSource: 'project',
                assetContentType: 'image/png',
                assetKind: 'web-clip',
            },
        ])
        expect(uploadedFiles[0]?.key).toBe(
            `projects/${project.id}/assets/web-clips/example-com/clip-batch-1/section-1.png`
        )
    })

    it('rejects clip creation when the project does not belong to the user', async () => {
        const owner = await createUser()
        const intruder = await createUser()
        const project = await createProject(owner.id)

        await expect(
            canvasService.createWebClips({
                url: 'https://example.com/path',
                userId: intruder.id,
                projectId: project.id,
            })
        ).rejects.toThrow('project not found')

        expect(spawnMock).not.toHaveBeenCalled()
        expect(putBinaryFileMock).not.toHaveBeenCalled()
        expect(rmMock).not.toHaveBeenCalled()
    })

    it('cleans up the worker directory when object storage upload fails', async () => {
        const user = await createUser()
        const clipDirectory = path.join(os.tmpdir(), 'phasehumans-web-clips', 'failed-upload')
        const clipPath = path.join(clipDirectory, 'section-1.png')

        clipFiles.set(clipPath, Buffer.from('broken-upload'))
        queueWorkerSuccess({
            directory: clipDirectory,
            full: path.join(clipDirectory, 'full.png'),
            width: 300,
            height: 200,
            sections: [
                {
                    path: clipPath,
                    width: 300,
                    height: 200,
                },
            ],
        })
        putBinaryFileError = new Error('s3 unavailable')

        await expect(
            canvasService.createWebClips({
                url: 'https://example.com/fail',
                userId: user.id,
            })
        ).rejects.toThrow('s3 unavailable')

        expect(rmMock).toHaveBeenCalledWith(clipDirectory, {
            recursive: true,
            force: true,
        })
    })
})
