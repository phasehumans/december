import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test, beforeAll, afterAll } from 'bun:test'

import { CdpBrowserSession } from '../../src/utils/browser/cdp-client'

describe('CdpBrowserSession (Unit)', () => {
    let mockWsServer: any
    let serverPort: number
    let mockChromeScript: string
    let tempDir: string

    beforeAll(async () => {
        tempDir = path.join(
            os.tmpdir(),
            `december-cdp-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        )
        await fs.mkdir(tempDir, { recursive: true })

        // 1. Start Mock CDP WebSocket Server using Bun.serve
        mockWsServer = Bun.serve({
            port: 0,
            fetch(req, server) {
                if (server.upgrade(req)) return
                return new Response('Mock CDP')
            },
            websocket: {
                message(ws, rawMsg) {
                    try {
                        const msg = JSON.parse(rawMsg.toString())
                        const { id, method, params } = msg

                        if (method === 'Target.createTarget') {
                            ws.send(JSON.stringify({ id, result: { targetId: 'mock-target-1' } }))
                        } else if (method === 'Target.attachToTarget') {
                            ws.send(JSON.stringify({ id, result: { sessionId: 'mock-session-1' } }))
                        } else if (
                            method === 'Page.enable' ||
                            method === 'Runtime.enable' ||
                            method === 'Network.enable'
                        ) {
                            ws.send(JSON.stringify({ id, result: {} }))
                        } else if (method === 'Page.navigate') {
                            ws.send(JSON.stringify({ id, result: { frameId: 'frame-1' } }))

                            // Emit CDP events for load, exceptions, console errors, and network errors
                            ws.send(
                                JSON.stringify({
                                    method: 'Page.loadEventFired',
                                    params: { timestamp: Date.now() },
                                })
                            )
                            ws.send(
                                JSON.stringify({
                                    method: 'Runtime.exceptionThrown',
                                    params: {
                                        exceptionDetails: {
                                            exception: {
                                                description:
                                                    'TypeError: Cannot read properties of undefined',
                                            },
                                        },
                                    },
                                })
                            )
                            ws.send(
                                JSON.stringify({
                                    method: 'Runtime.consoleAPICalled',
                                    params: {
                                        type: 'error',
                                        args: [{ value: 'Failed to load user profile' }],
                                    },
                                })
                            )
                            ws.send(
                                JSON.stringify({
                                    method: 'Network.responseReceived',
                                    params: {
                                        response: {
                                            status: 500,
                                            statusText: 'Internal Server Error',
                                            url: 'http://localhost/api/me',
                                        },
                                    },
                                })
                            )
                        } else if (method === 'Runtime.evaluate') {
                            const expr = params?.expression || ''
                            if (expr.includes('innerText')) {
                                ws.send(
                                    JSON.stringify({
                                        id,
                                        result: {
                                            result: { value: 'Mock Rendered Client Page Content' },
                                        },
                                    })
                                )
                            } else if (expr.includes('.click()')) {
                                ws.send(
                                    JSON.stringify({
                                        id,
                                        result: {
                                            result: {
                                                value: {
                                                    success: true,
                                                    tagName: 'BUTTON',
                                                    text: 'Submit Button',
                                                },
                                            },
                                        },
                                    })
                                )
                            } else if (expr.includes('.dispatchEvent(')) {
                                ws.send(
                                    JSON.stringify({
                                        id,
                                        result: {
                                            result: {
                                                value: {
                                                    success: true,
                                                    tagName: 'INPUT',
                                                    value: 'typed text',
                                                },
                                            },
                                        },
                                    })
                                )
                            } else {
                                ws.send(
                                    JSON.stringify({
                                        id,
                                        result: { result: { value: { success: true } } },
                                    })
                                )
                            }
                        } else if (method === 'Page.captureScreenshot') {
                            const mockPngBase64 = Buffer.from('fake-png-screenshot-bytes').toString(
                                'base64'
                            )
                            ws.send(JSON.stringify({ id, result: { data: mockPngBase64 } }))
                        } else {
                            ws.send(JSON.stringify({ id, result: {} }))
                        }
                    } catch {
                        // Intentionally swallowed: test mock error
                    }
                },
            },
        })

        serverPort = mockWsServer.port

        // 2. Create mock chrome executable script that announces the WebSocket port
        mockChromeScript = path.join(tempDir, 'mock-chrome.sh')
        const scriptContent = `#!/bin/sh\necho "DevTools listening on ws://127.0.0.1:${serverPort}/devtools/browser/mock" >&2\nexec sleep 120\n`
        await fs.writeFile(mockChromeScript, scriptContent, { mode: 0o755 })
    })

    afterAll(async () => {
        if (mockWsServer) {
            mockWsServer.stop()
        }
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: cleanup test dir
        }
    })

    test('launches session, connects via WebSocket, and attaches to target', async () => {
        const session = new CdpBrowserSession({
            chromePath: mockChromeScript,
            timeoutMs: 5000,
        })

        await session.launch()

        // Verify navigation and captured events
        const nav = await session.navigate('http://localhost:3000', 3000)
        expect(nav.text).toBe('Mock Rendered Client Page Content')
        expect(nav.consoleErrors.length).toBeGreaterThan(0)
        expect(nav.consoleErrors[0]).toContain('Cannot read properties of undefined')
        expect(nav.consoleErrors[1]).toContain('Failed to load user profile')
        expect(nav.networkErrors.length).toBeGreaterThan(0)
        expect(nav.networkErrors[0]).toContain('HTTP 500 Internal Server Error')

        // Verify click action
        const clickRes = await session.click('button#submit')
        expect(clickRes.success).toBe(true)
        expect(clickRes.output).toContain('Clicked <BUTTON>')

        // Verify type action
        const typeRes = await session.type('input#name', 'Test User')
        expect(typeRes.success).toBe(true)
        expect(typeRes.output).toContain('Typed "Test User"')

        // Verify screenshot action
        const shotRes = await session.screenshot(false)
        expect(shotRes.success).toBe(true)
        expect(shotRes.screenshotPath).toBeDefined()
        expect(shotRes.screenshotBase64).toBeDefined()
        if (shotRes.screenshotPath) {
            const exists = await fs
                .stat(shotRes.screenshotPath)
                .then(() => true)
                .catch(() => false)
            expect(exists).toBe(true)
            await fs.rm(shotRes.screenshotPath, { force: true })
        }

        // Verify getConsoleErrors
        const errors = await session.getConsoleErrors()
        expect(errors.consoleErrors.length).toBe(2)
        expect(errors.networkErrors.length).toBe(1)

        // Close session cleanly
        await session.close()
    })
})
