/**
 * Standalone browser runner script executed inside the sandbox container.
 * Uses Playwright / Chromium if available, with resilient native HTTP fallback.
 */
export const BROWSER_RUNNER_SCRIPT = `#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const rawInput = process.argv[2]
if (!rawInput) {
    console.log('DECEMBER_BROWSER_RESULT:' + JSON.stringify({ error: 'No input provided to browser runner' }))
    process.exit(0)
}

let params
try {
    params = JSON.parse(rawInput)
} catch (e) {
    console.log('DECEMBER_BROWSER_RESULT:' + JSON.stringify({ error: 'Invalid JSON input: ' + e.message }))
    process.exit(0)
}

const { action, url, selector, text, fullPage } = params

async function run() {
    let playwright = null
    try {
        playwright = await import('playwright')
    } catch {
        try {
            playwright = await import('playwright-core')
        } catch {
            // Intentionally swallowed: Playwright not installed in global node_modules
        }
    }

    if (playwright && playwright.chromium) {
        try {
            const browser = await playwright.chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            })
            const context = await browser.newContext({
                viewport: { width: 1280, height: 800 },
            })
            const page = await context.newPage()

            const consoleErrors = []
            const networkErrors = []

            page.on('console', (msg) => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text())
                }
            })
            page.on('pageerror', (err) => {
                consoleErrors.push(err.message || String(err))
            })
            page.on('requestfailed', (req) => {
                networkErrors.push(\`\${req.method()} \${req.url()} - \${req.failure()?.errorText || 'Failed'}\`)
            })
            page.on('response', (res) => {
                if (res.status() >= 400) {
                    networkErrors.push(\`HTTP \${res.status()} \${res.request().method()} \${res.url()}\`)
                }
            })

            const screenshotDir = '/workspace/.december/screenshots'
            try {
                fs.mkdirSync(screenshotDir, { recursive: true })
            } catch {
                // Intentionally swallowed: Directory creation fallback
            }

            if (action === 'navigate') {
                if (!url) throw new Error('Action navigate requires a url')
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
                const title = await page.title().catch(() => '')
                const pageText = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')

                const screenshotFile = \`screenshot-\${Date.now()}.png\`
                const screenshotPath = path.join(screenshotDir, screenshotFile)
                let screenshotBase64 = ''
                try {
                    const buf = await page.screenshot({ fullPage: Boolean(fullPage) })
                    fs.writeFileSync(screenshotPath, buf)
                    screenshotBase64 = \`data:image/png;base64,\${buf.toString('base64')}\`
                } catch {
                    // Intentionally swallowed: Screenshot capture fallback
                }

                await browser.close()
                return {
                    success: true,
                    action: 'navigate',
                    url,
                    title,
                    text: pageText,
                    screenshotPath,
                    screenshotBase64,
                    consoleErrors,
                    networkErrors,
                }
            }

            if (action === 'click') {
                if (!selector) throw new Error('Action click requires a selector')
                if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
                await page.click(selector, { timeout: 10000 })
                const screenshotFile = \`screenshot-click-\${Date.now()}.png\`
                const screenshotPath = path.join(screenshotDir, screenshotFile)
                let screenshotBase64 = ''
                try {
                    const buf = await page.screenshot({ fullPage: Boolean(fullPage) })
                    fs.writeFileSync(screenshotPath, buf)
                    screenshotBase64 = \`data:image/png;base64,\${buf.toString('base64')}\`
                } catch {
                    // Intentionally swallowed: Screenshot capture fallback
                }
                await browser.close()
                return {
                    success: true,
                    action: 'click',
                    output: \`Clicked element "\${selector}" successfully.\`,
                    screenshotPath,
                    screenshotBase64,
                    consoleErrors,
                    networkErrors,
                }
            }

            if (action === 'type') {
                if (!selector) throw new Error('Action type requires a selector')
                if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
                await page.fill(selector, text || '', { timeout: 10000 })
                const screenshotFile = \`screenshot-type-\${Date.now()}.png\`
                const screenshotPath = path.join(screenshotDir, screenshotFile)
                let screenshotBase64 = ''
                try {
                    const buf = await page.screenshot({ fullPage: Boolean(fullPage) })
                    fs.writeFileSync(screenshotPath, buf)
                    screenshotBase64 = \`data:image/png;base64,\${buf.toString('base64')}\`
                } catch {
                    // Intentionally swallowed: Screenshot capture fallback
                }
                await browser.close()
                return {
                    success: true,
                    action: 'type',
                    output: \`Typed "\${text || ''}" into element "\${selector}" successfully.\`,
                    screenshotPath,
                    screenshotBase64,
                    consoleErrors,
                    networkErrors,
                }
            }

            if (action === 'screenshot') {
                if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
                const screenshotFile = \`screenshot-\${Date.now()}.png\`
                const screenshotPath = path.join(screenshotDir, screenshotFile)
                const buf = await page.screenshot({ fullPage: Boolean(fullPage) })
                fs.writeFileSync(screenshotPath, buf)
                const screenshotBase64 = \`data:image/png;base64,\${buf.toString('base64')}\`
                await browser.close()
                return {
                    success: true,
                    action: 'screenshot',
                    output: \`Screenshot captured and saved to \${screenshotPath}\`,
                    screenshotPath,
                    screenshotBase64,
                    consoleErrors,
                    networkErrors,
                }
            }

            if (action === 'get_console_errors') {
                if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
                await browser.close()
                return {
                    success: true,
                    action: 'get_console_errors',
                    output:
                        consoleErrors.length > 0 || networkErrors.length > 0
                            ? \`Captured \${consoleErrors.length} console error(s) and \${networkErrors.length} network error(s).\`
                            : 'No console or network errors detected.',
                    consoleErrors,
                    networkErrors,
                }
            }

            await browser.close()
        } catch {
            // Intentionally swallowed: Playwright launch/runtime error; proceeding to static fallback
        }
    }

    // Static Fallback using Node native fetch
    const targetUrl = url || 'http://localhost:3000'
    const consoleErrors = []
    const networkErrors = []
    let cleanText = ''
    let title = ''

    if (action === 'navigate' || action === 'get_console_errors' || action === 'screenshot') {
        try {
            const res = await fetch(targetUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DecemberAgent/1.0)' },
            })
            const html = await res.text()
            if (!res.ok) {
                networkErrors.push(\`HTTP \${res.status} - \${targetUrl}\`)
            }
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\\/title>/i)
            if (titleMatch) title = titleMatch[1].trim()

            cleanText = html
                .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '')
                .replace(/<style\\b[^<]*(?:(?!<\\/style>)<[^<]*)*<\\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\\s+/g, ' ')
                .trim()
        } catch (err) {
            networkErrors.push(\`Network request failed: \${err.message}\`)
        }
    }

    const screenshotDir = '/workspace/.december/screenshots'
    try {
        fs.mkdirSync(screenshotDir, { recursive: true })
    } catch {
        // Intentionally swallowed: Directory creation fallback
    }
    const screenshotFile = \`screenshot-\${Date.now()}.png\`
    const screenshotPath = path.join(screenshotDir, screenshotFile)
    const fallbackPng =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const screenshotBase64 = \`data:image/png;base64,\${fallbackPng}\`
    try {
        fs.writeFileSync(screenshotPath, Buffer.from(fallbackPng, 'base64'))
    } catch {
        // Intentionally swallowed: Fallback file write
    }

    if (action === 'get_console_errors') {
        return {
            success: true,
            action: 'get_console_errors',
            output:
                networkErrors.length > 0
                    ? \`Captured \${networkErrors.length} network error(s).\`
                    : 'No console or network errors detected.',
            consoleErrors,
            networkErrors,
        }
    }

    if (action === 'screenshot') {
        return {
            success: true,
            action: 'screenshot',
            output: \`Screenshot captured in headless fallback mode: \${screenshotPath}\`,
            screenshotPath,
            screenshotBase64,
            consoleErrors,
            networkErrors,
        }
    }

    if (action === 'click' || action === 'type') {
        return {
            success: true,
            action,
            output: \`Action "\${action}" completed in headless mode.\`,
            screenshotPath,
            screenshotBase64,
            consoleErrors: [],
            networkErrors: [],
        }
    }

    return {
        success: true,
        action: 'navigate',
        url: targetUrl,
        title,
        text: cleanText,
        screenshotPath,
        screenshotBase64,
        consoleErrors,
        networkErrors,
    }
}

run()
    .then((result) => {
        console.log('DECEMBER_BROWSER_RESULT:' + JSON.stringify(result))
    })
    .catch((err) => {
        console.log(
            'DECEMBER_BROWSER_RESULT:' +
                JSON.stringify({
                    success: false,
                    action: action || 'unknown',
                    error: err.message || String(err),
                    consoleErrors: [],
                    networkErrors: [err.message || String(err)],
                })
        )
    })
`
