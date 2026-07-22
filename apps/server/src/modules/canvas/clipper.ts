import crypto from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { chromium } from 'playwright'
import sharp from 'sharp'

const VIEWPORT = {
    width: 1440,
    height: 900,
}

const SECTION_HEIGHT = 900
const TEMP_ROOT = path.resolve(os.tmpdir(), 'december-web-clips')

let activeDirectory: string | null = null

const normalizePath = (value: string) =>
    path
        .resolve(value)
        .replace(/[\\/]+$/, '')
        .toLowerCase()

const isSafeTempPath = (value: string) => {
    const target = normalizePath(value)
    const root = normalizePath(TEMP_ROOT)
    return target === root || target.startsWith(`${root}${path.sep}`)
}

const cleanupDirectory = async (directory: string | null) => {
    if (!directory || !isSafeTempPath(directory)) {
        return
    }

    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
}

const getPageHeight = async (page: any) => {
    return await page.evaluate(() => {
        const doc = (globalThis as any).document
        const body = doc?.body
        const win = globalThis as any

        return Math.max(
            doc?.documentElement?.scrollHeight ?? 0,
            body?.scrollHeight ?? 0,
            doc?.documentElement?.offsetHeight ?? 0,
            body?.offsetHeight ?? 0,
            doc?.documentElement?.clientHeight ?? 0,
            body?.clientHeight ?? 0,
            win.innerHeight || 0
        )
    })
}

export async function clipper(url: string) {
    const id = crypto.randomUUID()
    const dir = path.join(TEMP_ROOT, id)
    activeDirectory = dir

    await mkdir(dir, { recursive: true })

    const fullScreenshotPath = path.join(dir, 'full.png')

    const browser = await chromium.launch({
        headless: true,
    })

    try {
        const page = await browser.newPage({
            ignoreHTTPSErrors: true,
        })

        await page.setViewportSize(VIEWPORT)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)
        await page.waitForTimeout(1000)

        const pageHeight = Math.max(Math.ceil(await getPageHeight(page)), VIEWPORT.height)

        await page.screenshot({
            path: fullScreenshotPath,
            fullPage: true,
            type: 'png',
            animations: 'disabled',
        })

        const fullImage = sharp(fullScreenshotPath)
        const metadata = await fullImage.metadata()

        const actualWidth = metadata.width ?? VIEWPORT.width
        const actualHeight = metadata.height ?? pageHeight

        const sections: { path: string; width: number; height: number }[] = []

        for (let top = 0, index = 1; top < actualHeight; top += SECTION_HEIGHT, index += 1) {
            const height = Math.min(SECTION_HEIGHT, actualHeight - top)
            const sectionPath = path.join(dir, `section-${index}.png`)

            await sharp(fullScreenshotPath)
                .extract({
                    left: 0,
                    top,
                    width: actualWidth,
                    height,
                })
                .png()
                .toFile(sectionPath)

            sections.push({
                path: sectionPath,
                width: actualWidth,
                height,
            })
        }

        return {
            directory: dir,
            full: fullScreenshotPath,
            width: actualWidth,
            height: actualHeight,
            sections,
        }
    } finally {
        await browser.close()
    }
}

if (process.argv[1]?.endsWith('clipper.ts') || process.argv[1]?.endsWith('clipper.js')) {
    const urlArg = process.argv[2]
    if (urlArg) {
        clipper(urlArg)
            .then((result) => {
                activeDirectory = null
                console.log(JSON.stringify(result))
            })
            .catch(async (err) => {
                await cleanupDirectory(activeDirectory)
                console.error(err instanceof Error ? err.stack || err.message : String(err))
                process.exit(1)
            })
    }
}
