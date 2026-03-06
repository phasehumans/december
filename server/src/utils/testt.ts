import { chromium} from 'playwright'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export async function clipper(url: string) {
    const id = crypto.randomUUID()
    const dir = path.join('screens', id)

    console.log('Saving screenshots to:', dir)

    await fs.mkdir(dir, { recursive: true })

    const fullScreenshotPath = path.join(dir, 'full.png')

    console.log('Launching browser...')
    const browser = await chromium.launch({
        headless: false,
    })

    console.log('Creating page...')
    const page = await browser.newPage()

    console.log('Setting viewport...')
    await page.setViewportSize({
        width: 1440,
        height: 900,
    })

    console.log('Opening URL...')
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
    })

    await page.waitForTimeout(3000)

    await page.screenshot({
        path: fullScreenshotPath,
        fullPage: true,
    })

    console.log('Screenshot saved:', fullScreenshotPath)

    await browser.close()

    const exists = await fs.stat(fullScreenshotPath).catch(() => null)

    if (!exists) {
        throw new Error('Screenshot was not created')
    }

    const image = sharp(fullScreenshotPath)
    const meta = await image.metadata()

    const width = meta.width!
    const height = meta.height!

    const sectionHeight = 900

    const sections: string[] = []

    for (let top = 0; top < height; top += sectionHeight) {
        const sectionPath = path.join(dir, `section-${top}.png`)

        await sharp(fullScreenshotPath)
            .extract({
                left: 0,
                top,
                width,
                height: Math.min(sectionHeight, height - top),
            })
            .toFile(sectionPath)

        sections.push(sectionPath)
    }

    return {
        full: fullScreenshotPath,
        sections,
    }
}

clipper('https://www.notion.com/')
    .then((res) => {
        console.log(res)
    })
    .catch((err) => {
        console.log(err)
    })
