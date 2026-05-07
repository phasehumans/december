import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

import sharp from 'sharp'
import { chromium } from 'playwright'

const VIEWPORT = {
    width: 1440,
    height: 900,
}

const SECTION_HEIGHT = 900
const TEMP_ROOT = path.resolve(os.tmpdir(), 'december-web-clips')

let activeDirectory = null

const normalizePath = (value) =>
    path
        .resolve(value)
        .replace(/[\\/]+$/, '')
        .toLowerCase()

const isSafeTempPath = (value) => {
    const target = normalizePath(value)
    const root = normalizePath(TEMP_ROOT)
    return target === root || target.startsWith(`${root}${path.sep}`)
}

const cleanupDirectory = async (directory) => {
    if (!directory || !isSafeTempPath(directory)) {
        return
    }

    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
}

const getPageHeight = async (page) => {
    return await page.evaluate(() => {
        const doc = document.documentElement
        const body = document.body

        return Math.max(
            doc?.scrollHeight ?? 0,
            body?.scrollHeight ?? 0,
            doc?.offsetHeight ?? 0,
            body?.offsetHeight ?? 0,
            doc?.clientHeight ?? 0,
            body?.clientHeight ?? 0,
            window.innerHeight
        )
    })
}

async function clipper(url) {
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

        // Capture ONE deterministic full-page screenshot
        await page.screenshot({
            path: fullScreenshotPath,
            fullPage: true,
            type: 'png',
            animations: 'disabled',
        })

        // Read actual image metadata instead of trusting computed page height blindly
        const fullImage = sharp(fullScreenshotPath)
        const metadata = await fullImage.metadata()

        const actualWidth = metadata.width ?? VIEWPORT.width
        const actualHeight = metadata.height ?? pageHeight

        const sections = []

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

const url = process.argv[2]

if (!url) {
    console.error('Missing URL argument for clipper worker')
    process.exit(1)
}

clipper(url)
    .then((result) => {
        activeDirectory = null
        console.log(JSON.stringify(result))
    })
    .catch(async (err) => {
        await cleanupDirectory(activeDirectory)
        console.error(err instanceof Error ? err.stack || err.message : String(err))
        process.exit(1)
    })
