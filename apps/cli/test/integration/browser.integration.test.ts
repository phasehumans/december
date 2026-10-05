import http from 'node:http'

import { describe, expect, test, beforeAll, afterAll } from 'bun:test'

import { localOperations } from '../../src/local-operations'

describe('Browser Engine Integration', () => {
    let server: http.Server
    let serverUrl: string

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            if (req.url === '/dashboard') {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>Dashboard</title></head>
                    <body>
                        <h1>Project Control Center</h1>
                        <p>Status: All microservices operational.</p>
                        <button id="refresh-btn">Refresh Metrics</button>
                    </body>
                    </html>
                `)
            } else if (req.url === '/api/broken') {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Bad Gateway' }))
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
        if (localOperations.browser?.close) {
            await localOperations.browser.close()
        }
        await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    test('localOperations.browser.navigate fetches page content cleanly', async () => {
        const result = await localOperations.browser?.navigate(`${serverUrl}/dashboard`)

        expect(result).toBeDefined()
        expect(result?.text).toContain('Project Control Center')
        expect(result?.text).toContain('Status: All microservices operational.')
        expect(result?.error).toBeUndefined()
    })

    test('localOperations.browser.navigate captures HTTP failure correctly', async () => {
        const result = await localOperations.browser?.navigate(`${serverUrl}/api/broken`)

        expect(result).toBeDefined()
        expect(result?.error).toContain('HTTP Error (502)')
        expect(result?.networkErrors).toBeDefined()
        expect(result?.networkErrors?.length).toBeGreaterThan(0)
    })

    test('localOperations.browser.action executes navigate action seamlessly', async () => {
        const result = await localOperations.browser?.action?.({
            action: 'navigate',
            url: `${serverUrl}/dashboard`,
        })

        expect(result).toBeDefined()
        expect(result?.success).toBe(true)
        expect(result?.action).toBe('navigate')
        expect(result?.text).toContain('Project Control Center')
    })

    test('localOperations.browser.action handles get_console_errors', async () => {
        const result = await localOperations.browser?.action?.({
            action: 'get_console_errors',
        })

        expect(result).toBeDefined()
        expect(result?.success).toBe(true)
        expect(result?.action).toBe('get_console_errors')
        expect(result?.output).toBeDefined()
    })
})
