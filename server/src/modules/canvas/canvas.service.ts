import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

import { prisma } from '../../config/db'
import { AppError } from '../../shared/appError'
import { assetKey, putBinaryFile, temporaryCanvasAssetKey } from '../../shared/project-storage'

import { persistCanvasDocument } from './canvas.persistence'

import type {
    ClipperWorkerResult,
    ClipperWorkerSection,
    CreateWebClips,
    SaveCanvas,
} from './canvas.types'

const IMAGE_CONTENT_TYPE = 'image/png'
const CLIPPER_WORKER_TIMEOUT_MS = 120000
const CLIPPER_WORKER_PATH = fileURLToPath(new URL('./clipper.js', import.meta.url))
const CLIPPER_TEMP_ROOT = path.resolve(os.tmpdir(), 'december-web-clips')

const toDataUrl = (buffer: Buffer) =>
    `data:${IMAGE_CONTENT_TYPE};base64,${buffer.toString('base64')}`

const sanitizeUrlPathSegment = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'website'

const normalizeComparablePath = (value: string) =>
    path
        .resolve(value)
        .replace(/[\\/]+$/, '')
        .toLowerCase()

const isSafeClipperPath = (value: string) => {
    const target = normalizeComparablePath(value)
    const root = normalizeComparablePath(CLIPPER_TEMP_ROOT)
    return target === root || target.startsWith(`${root}${path.sep}`)
}

const cleanupClipperDirectory = async (directory?: string) => {
    if (!directory || !isSafeClipperPath(directory)) {
        return
    }

    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
}

const parseClipperWorkerOutput = (stdout: string): ClipperWorkerResult => {
    const lines = stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
    const jsonLine = lines.at(-1)

    if (!jsonLine) {
        throw new AppError('clipper worker returned no output')
    }

    let parsed: unknown

    try {
        parsed = JSON.parse(jsonLine)
    } catch {
        throw new AppError('clipper worker returned invalid JSON output')
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new AppError('clipper worker returned an invalid payload')
    }

    const result = parsed as Partial<ClipperWorkerResult>

    if (typeof result.directory !== 'string' || !Array.isArray(result.sections)) {
        throw new AppError('clipper worker response is missing required fields')
    }

    const sections = result.sections.filter(
        (section): section is ClipperWorkerSection =>
            Boolean(section) &&
            typeof section.path === 'string' &&
            typeof section.width === 'number' &&
            typeof section.height === 'number'
    )

    if (sections.length === 0) {
        throw new AppError('clipper worker did not produce any image sections')
    }

    return {
        directory: result.directory,
        full: typeof result.full === 'string' ? result.full : '',
        width: typeof result.width === 'number' ? result.width : sections[0]!.width,
        height:
            typeof result.height === 'number'
                ? result.height
                : sections.reduce((sum, section) => sum + section.height, 0),
        sections,
    }
}

const runClipperWorker = async (url: string) => {
    return await new Promise<ClipperWorkerResult>((resolve, reject) => {
        const child = spawn('node', [CLIPPER_WORKER_PATH, url], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        })

        let stdout = ''
        let stderr = ''
        let isSettled = false

        const settle = (handler: () => void) => {
            if (isSettled) {
                return
            }

            isSettled = true
            clearTimeout(timeout)
            handler()
        }

        const timeout = setTimeout(() => {
            child.kill()
            settle(() => reject(new AppError('clipper worker timed out')))
        }, CLIPPER_WORKER_TIMEOUT_MS)

        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')

        child.stdout.on('data', (chunk) => {
            stdout += chunk
        })

        child.stderr.on('data', (chunk) => {
            stderr += chunk
        })

        child.on('error', (error) => {
            settle(() => reject(error))
        })

        child.on('close', (code) => {
            settle(() => {
                if (code !== 0) {
                    const message = stderr.trim() || `clipper worker exited with code ${code}`
                    reject(new AppError(message))
                    return
                }

                try {
                    resolve(parseClipperWorkerOutput(stdout))
                } catch (error) {
                    reject(
                        error instanceof AppError ? error : new AppError('clipper worker failed')
                    )
                }
            })
        })
    })
}

const assertProjectAccess = async (projectId: string, userId: string) => {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
        select: {
            id: true,
        },
    })

    if (!project) {
        throw new AppError('project not found')
    }
}

const createWebClips = async (data: CreateWebClips) => {
    const { url, userId, projectId } = data
    if (projectId) {
        await assertProjectAccess(projectId, userId)
    }

    let clipperOutput: ClipperWorkerResult | null = null

    try {
        clipperOutput = await runClipperWorker(url)

        const batchId = randomUUID()
        const sourceHost = sanitizeUrlPathSegment(new URL(url).hostname)
        const clipDirectory = `web-clips/${sourceHost}/${batchId}`

        const clips = await Promise.all(
            clipperOutput.sections.map(async (clip, index) => {
                const buffer = await readFile(clip.path)
                const key = projectId
                    ? assetKey(projectId, `${clipDirectory}/section-${index + 1}.png`)
                    : temporaryCanvasAssetKey(userId, `${clipDirectory}/section-${index + 1}.png`)

                await putBinaryFile({
                    key,
                    content: buffer,
                    contentType: IMAGE_CONTENT_TYPE,
                })

                return {
                    id: `${batchId}-${index + 1}`,
                    content: toDataUrl(buffer),
                    width: clip.width,
                    height: clip.height,
                    assetKey: key,
                    assetSource: projectId ? ('project' as const) : ('temporary' as const),
                    assetContentType: IMAGE_CONTENT_TYPE,
                    assetKind: 'web-clip' as const,
                }
            })
        )

        return {
            sourceUrl: url,
            clips,
        }
    } finally {
        await cleanupClipperDirectory(clipperOutput?.directory)
    }
}

const saveCanvas = async (data: SaveCanvas) => {
    const { projectId, userId, versionId, canvasState } = data
    await assertProjectAccess(projectId, userId)

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { currentVersionId: true },
    })

    if (!project) {
        throw new AppError('project not found')
    }

    const targetVersionId = versionId || project.currentVersionId
    if (!targetVersionId) {
        throw new AppError('no project version found to save canvas state')
    }

    const persistedCanvas = await persistCanvasDocument({
        projectId,
        userId,
        versionId: targetVersionId,
        canvasState,
    })

    await prisma.projectVersion.update({
        where: { id: targetVersionId },
        data: {
            canvasStateJson: persistedCanvas.canvasStateJson as any,
            canvasAssetManifestJson: persistedCanvas.canvasAssetManifestJson as any,
        },
    })

    return {
        success: true,
        canvasState: persistedCanvas.canvasStateJson,
    }
}

export const canvasService = {
    createWebClips,
    saveCanvas,
}
