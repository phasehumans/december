import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { prisma } from '../../config/db'
import {
    assetKey,
    putBinaryFile,
    temporaryCanvasAssetKey,
} from '../../lib/project-storage'

type CreateWebClipsInput = {
    url: string
    userId: string
    projectId?: string
}

type ClipperWorkerSection = {
    path: string
    width: number
    height: number
}

type ClipperWorkerResult = {
    directory: string
    full: string
    width: number
    height: number
    sections: ClipperWorkerSection[]
}

const IMAGE_CONTENT_TYPE = 'image/png'
const CLIPPER_WORKER_TIMEOUT_MS = 120000
const CLIPPER_WORKER_PATH = fileURLToPath(new URL('../../utils/clipper.js', import.meta.url))
const CLIPPER_TEMP_ROOT = path.resolve(os.tmpdir(), 'phasehumans-web-clips')

const toDataUrl = (buffer: Buffer) => `data:${IMAGE_CONTENT_TYPE};base64,${buffer.toString('base64')}`

const sanitizeUrlPathSegment = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'website'

const normalizeComparablePath = (value: string) =>
    path.resolve(value).replace(/[\\/]+$/, '').toLowerCase()

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
        throw new Error('clipper worker returned no output')
    }

    let parsed: unknown

    try {
        parsed = JSON.parse(jsonLine)
    } catch {
        throw new Error('clipper worker returned invalid JSON output')
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('clipper worker returned an invalid payload')
    }

    const result = parsed as Partial<ClipperWorkerResult>

    if (typeof result.directory !== 'string' || !Array.isArray(result.sections)) {
        throw new Error('clipper worker response is missing required fields')
    }

    const sections = result.sections.filter(
        (section): section is ClipperWorkerSection =>
            Boolean(section) &&
            typeof section.path === 'string' &&
            typeof section.width === 'number' &&
            typeof section.height === 'number'
    )

    if (sections.length === 0) {
        throw new Error('clipper worker did not produce any image sections')
    }

    return {
        directory: result.directory,
        full: typeof result.full === 'string' ? result.full : '',
        width: typeof result.width === 'number' ? result.width : sections[0]!.width,
        height: typeof result.height === 'number' ? result.height : sections.reduce((sum, section) => sum + section.height, 0),
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
            settle(() => reject(new Error('clipper worker timed out')))
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
                    reject(new Error(message))
                    return
                }

                try {
                    resolve(parseClipperWorkerOutput(stdout))
                } catch (error) {
                    reject(error instanceof Error ? error : new Error('clipper worker failed'))
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
        throw new Error('project not found')
    }
}

const createWebClips = async ({ url, userId, projectId }: CreateWebClipsInput) => {
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

export const canvasService = {
    createWebClips,
}
