import { chromium } from "playwright"
import sharp from "sharp"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"

import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function clipper(url) {
  const id = crypto.randomUUID()
  const dir = path.resolve(__dirname, "../assets/", id)

  await fs.mkdir(dir, { recursive: true })

  const fullScreenshotPath = path.join(dir, "full.png")

  const browser = await chromium.launch({
    headless: false
  })

  const page = await browser.newPage()

  await page.setViewportSize({
    width: 1440,
    height: 900
  })

  await page.goto(url, { waitUntil: "domcontentloaded" })

  await page.waitForTimeout(3000)

  await page.screenshot({
    path: fullScreenshotPath,
    fullPage: true
  })

  await browser.close()

  const exists = await fs.stat(fullScreenshotPath).catch(() => null)

  if (!exists) {
    throw new Error("Screenshot was not created")
  }

  const image = sharp(fullScreenshotPath)
  const meta = await image.metadata()

  const width = meta.width
  const height = meta.height

  const sectionHeight = 900
  const sections = []

  for (let top = 0; top < height; top += sectionHeight) {
    const sectionPath = path.join(dir, `section-${top}.png`)

    await sharp(fullScreenshotPath)
      .extract({
        left: 0,
        top,
        width,
        height: Math.min(sectionHeight, height - top)
      })
      .toFile(sectionPath)

    sections.push(sectionPath)
  }

  return {
    full: fullScreenshotPath,
    sections
  }
}

const url = process.argv[2]

clipper(url)
  .then((result) => {
    console.log(JSON.stringify(result))
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })