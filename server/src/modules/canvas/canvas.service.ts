import { randomUUID } from 'crypto'
import { chromium } from 'playwright'
import sharp from 'sharp'
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

const SECTION_HEIGHT = 900
const IMAGE_CONTENT_TYPE = 'image/png'

const toDataUrl = (buffer: Buffer) => `data:${IMAGE_CONTENT_TYPE};base64,${buffer.toString('base64')}`

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

const captureScreenshot = async (url: string) => {
    const browser = await chromium.launch({
        headless: true,
    })

    try {
        const page = await browser.newPage({
            viewport: {
                width: 1440,
                height: 900,
            },
        })

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
        } catch {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        }

        await page.waitForTimeout(2000)
        return Buffer.from(await page.screenshot({ fullPage: true, type: 'png' }))
    } finally {
        await browser.close()
    }
}

const splitScreenshot = async (screenshot: Buffer) => {
    const image = sharp(screenshot)
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height) {
        throw new Error('failed to read screenshot dimensions')
    }

    const clips: Array<{ buffer: Buffer; width: number; height: number }> = []

    for (let top = 0; top < metadata.height; top += SECTION_HEIGHT) {
        const height = Math.min(SECTION_HEIGHT, metadata.height - top)
        const buffer = await sharp(screenshot)
            .extract({
                left: 0,
                top,
                width: metadata.width,
                height,
            })
            .png()
            .toBuffer()

        clips.push({
            buffer,
            width: metadata.width,
            height,
        })
    }

    return clips
}

const createWebClips = async ({ url, userId, projectId }: CreateWebClipsInput) => {
    if (projectId) {
        await assertProjectAccess(projectId, userId)
    }

    const screenshot = await captureScreenshot(url)
    const splitClips = await splitScreenshot(screenshot)
    const batchId = randomUUID()

    const clips = await Promise.all(
        splitClips.map(async (clip, index) => {
            const key = projectId
                ? assetKey(projectId, `web-clips/${batchId}/section-${index + 1}.png`)
                : temporaryCanvasAssetKey(userId, `web-clips/${batchId}/section-${index + 1}.png`)

            await putBinaryFile({
                key,
                content: clip.buffer,
                contentType: IMAGE_CONTENT_TYPE,
            })

            return {
                id: `${batchId}-${index + 1}`,
                content: toDataUrl(clip.buffer),
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
}

export const canvasService = {
    createWebClips,
}
