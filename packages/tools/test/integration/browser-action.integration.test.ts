import http from 'node:http'

import { describe, expect, test, beforeAll, afterAll } from 'bun:test'

import { BrowserTool } from '../../src/browser'
import { BrowserActionTool } from '../../src/browser_action'
import { createMockContext } from '../mock-context'

describe('Browser Tools Integration', () => {
    let server: http.Server
    let serverUrl: string

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            if (req.url === '/app') {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <body>
                        <h1>App Storefront</h1>
                        <button id="buy-btn">Buy Product</button>
                    </body>
                    </html>
                `)
            } else if (req.url === '/crash') {
                res.writeHead(500, { 'Content-Type': 'text/plain' })
                res.end('Server Exception')
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
        await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    test('BrowserTool formats rendered content and errors against a test server', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: async (url: string) => {
                const res = await fetch(url)
                const text = await res.text()
                if (!res.ok) {
                    return {
                        text: '',
                        error: `HTTP Error (${res.status})`,
                        networkErrors: [`HTTP ${res.status} - ${url}`],
                    }
                }
                return {
                    text: text.replace(/<[^>]+>/g, ' ').trim(),
                    consoleErrors: ['[console.warn] Deprecated API call'],
                    networkErrors: [],
                }
            },
        }

        const resultSuccess = await BrowserTool.execute({ url: `${serverUrl}/app` }, context)
        expect(resultSuccess).toContain('App Storefront')
        expect(resultSuccess).toContain('[CONSOLE ERRORS]')
        expect(resultSuccess).toContain('- [console.warn] Deprecated API call')

        const resultFail = await BrowserTool.execute({ url: `${serverUrl}/crash` }, context)
        expect(resultFail).toContain('Failed to fetch URL: HTTP Error (500)')
    })

    test('BrowserActionTool executes navigate and get_console_errors seamlessly', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: async (url: string) => ({ text: 'Default' }),
            action: async (params) => {
                if (params.action === 'navigate') {
                    return {
                        success: true,
                        action: 'navigate',
                        text: 'Rendered Storefront',
                        consoleErrors: ['[console.error] Image not found'],
                    }
                }
                if (params.action === 'get_console_errors') {
                    return {
                        success: true,
                        action: 'get_console_errors',
                        output: 'Captured 1 error(s).',
                        consoleErrors: ['[console.error] Image not found'],
                    }
                }
                return {
                    success: false,
                    action: params.action,
                    error: 'Unsupported',
                }
            },
        }

        const navRes = await BrowserActionTool.execute(
            { action: 'navigate', url: `${serverUrl}/app` },
            context
        )
        expect(navRes).toContain('Rendered Storefront')
        expect(navRes).toContain('[CONSOLE ERRORS]')
        expect(navRes).toContain('- [console.error] Image not found')

        const errRes = await BrowserActionTool.execute({ action: 'get_console_errors' }, context)
        expect(errRes).toContain('Captured 1 error(s).')
        expect(errRes).toContain('- [console.error] Image not found')
    })
})
