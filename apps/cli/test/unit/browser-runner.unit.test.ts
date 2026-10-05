import http from 'node:http'

import { describe, expect, test, beforeAll, afterAll } from 'bun:test'

import { browserRunner } from '../../src/utils/browser/browser-runner'
import { resetChromePathCache } from '../../src/utils/browser/detector'

describe('Browser Runner (Unit)', () => {
    let server: http.Server
    let serverUrl: string

    beforeAll(async () => {
        // Force fallback mode for deterministic runner unit testing
        delete process.env.CHROME_PATH
        delete process.env.CHROME_BIN
        delete process.env.CHROMIUM_PATH
        delete process.env.PUPPETEER_EXECUTABLE_PATH
        resetChromePathCache()

        // Start a lightweight local test HTTP server
        server = http.createServer((req, res) => {
            if (req.url === '/html') {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Test Page</title>
                        <style>body { color: red; }</style>
                        <script>console.log("secret script");</script>
                    </head>
                    <body>
                        <header><h1>Welcome to December</h1></header>
                        <main><p>This is a rendered test page paragraph.</p></main>
                    </body>
                    </html>
                `)
            } else if (req.url === '/500') {
                res.writeHead(500, { 'Content-Type': 'text/plain' })
                res.end('Internal Server Error Occurred')
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' })
                res.end('Not Found')
            }
        })

        await new Promise<void>((resolve) => {
            server.listen(0, '127.0.0.1', () => {
                const addr = server.address() as any
                serverUrl = `http://127.0.0.1:${addr.port}`
                resolve()
            })
        })
    })

    afterAll(async () => {
        await browserRunner.close()
        await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    test('static fallback fetch extracts clean text without scripts and styles', async () => {
        const result = await browserRunner.staticFallbackFetch(`${serverUrl}/html`)

        expect(result.text).toContain('Welcome to December')
        expect(result.text).toContain('This is a rendered test page paragraph.')
        expect(result.text).not.toContain('secret script')
        expect(result.text).not.toContain('color: red')
        expect(result.text).toContain('[Note: Local Chrome/Chromium not detected')
    })

    test('static fallback fetch records HTTP error on 500 status', async () => {
        const result = await browserRunner.staticFallbackFetch(`${serverUrl}/500`)

        expect(result.error).toContain('HTTP Error (500)')
        expect(result.networkErrors).toBeDefined()
        expect(result.networkErrors?.length).toBeGreaterThan(0)
        expect(result.networkErrors?.[0]).toContain('HTTP 500')
    })

    test('navigate delegates to fallback when system Chrome is unavailable', async () => {
        const result = await browserRunner.navigate(`${serverUrl}/html`)

        expect(result.text).toContain('Welcome to December')
        expect(result.error).toBeUndefined()
    })

    test('action navigate succeeds and returns text content', async () => {
        const result = await browserRunner.action({
            action: 'navigate',
            url: `${serverUrl}/html`,
        })

        expect(result.success).toBe(true)
        expect(result.action).toBe('navigate')
        expect(result.text).toContain('Welcome to December')
    })

    test('action navigate fails gracefully if url is missing', async () => {
        const result = await browserRunner.action({
            action: 'navigate',
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('requires a valid "url" parameter')
    })

    test('action get_console_errors returns clean message when no active session', async () => {
        const result = await browserRunner.action({
            action: 'get_console_errors',
        })

        expect(result.success).toBe(true)
        expect(result.output).toBeDefined()
    })

    test('action click requires Chrome and selector', async () => {
        // Missing selector
        const resMissing = await browserRunner.action({
            action: 'click',
        })
        expect(resMissing.success).toBe(false)

        // When Chrome is not available
        const resNoChrome = await browserRunner.action({
            action: 'click',
            selector: 'button#test',
        })
        expect(resNoChrome.success).toBe(false)
        expect(resNoChrome.error).toContain('requires Google Chrome or Chromium')
    })

    test('action type requires Chrome and selector', async () => {
        const resNoChrome = await browserRunner.action({
            action: 'type',
            selector: 'input#email',
            text: 'hello@test.com',
        })
        expect(resNoChrome.success).toBe(false)
        expect(resNoChrome.error).toContain('requires Google Chrome or Chromium')
    })

    test('action screenshot requires Chrome', async () => {
        const resNoChrome = await browserRunner.action({
            action: 'screenshot',
            fullPage: true,
        })
        expect(resNoChrome.success).toBe(false)
        expect(resNoChrome.error).toContain('requires Google Chrome or Chromium')
    })

    test('rejects unsupported action', async () => {
        const res = await browserRunner.action({
            action: 'unknown_action' as any,
        })
        expect(res.success).toBe(false)
        expect(res.error).toBeDefined()
    })
})
