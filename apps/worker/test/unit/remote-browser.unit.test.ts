import { describe, expect, it, mock } from 'bun:test'

import { RemotePlatformAdapter } from '../../src/remote-operations'

describe('RemotePlatformAdapter Browser Automation Bridge (Ticket #591 - Seam 1)', () => {
    it('should navigate to URL, parse browser result, and publish viewport update to Redis', async () => {
        const publishedEvents: Array<{ channel: string; message: string }> = []
        const cachedKeys: Record<string, string> = {}

        const mockRedis = {
            publish: mock(async (channel: string, message: string) => {
                publishedEvents.push({ channel, message })
                return 1
            }),
            set: mock(async (key: string, val: string) => {
                cachedKeys[key] = val
                return 'OK'
            }),
        }

        const adapter = new RemotePlatformAdapter('mock-vm-browser-1', {
            sessionId: 'sess-browser-101',
            redisClient: mockRedis,
        })

        // Mock bash.exec to return simulated browser runner JSON output
        const simulatedResult = {
            success: true,
            action: 'navigate',
            url: 'http://localhost:3000/dashboard',
            title: 'December Workspace',
            text: 'Welcome to December Fullstack App',
            screenshotPath: '/workspace/.december/screenshots/screenshot-1.png',
            screenshotBase64: 'data:image/png;base64,mockPngBase64Data',
            consoleErrors: ['Uncaught ReferenceError: foo is not defined'],
            networkErrors: ['HTTP 404 GET /api/missing-asset'],
        }

        adapter.bash.exec = mock(async (cmd: string) => {
            if (cmd.includes('december-browser-runner.mjs')) {
                return {
                    exitCode: 0,
                    output: `Some node logs\nDECEMBER_BROWSER_RESULT:${JSON.stringify(simulatedResult)}\n`,
                }
            }
            return { exitCode: 0, output: '' }
        }) as any

        const navResult = await adapter.browser.navigate('http://localhost:3000/dashboard')

        expect(navResult.text).toBe('Welcome to December Fullstack App')
        expect(navResult.consoleErrors).toEqual(['Uncaught ReferenceError: foo is not defined'])
        expect(navResult.networkErrors).toEqual(['HTTP 404 GET /api/missing-asset'])

        // Verify Redis publication
        expect(publishedEvents.length).toBe(1)
        expect(publishedEvents[0].channel).toBe('session_events:sess-browser-101')
        const parsedEvent = JSON.parse(publishedEvents[0].message)
        expect(parsedEvent.type).toBe('BrowserViewportUpdate')
        expect(parsedEvent.url).toBe('http://localhost:3000/dashboard')
        expect(parsedEvent.screenshot).toBe('data:image/png;base64,mockPngBase64Data')
        expect(parsedEvent.consoleErrors.length).toBe(1)

        // Verify Redis cache
        expect(cachedKeys['session_desktop_viewport:sess-browser-101']).toBeDefined()
        const cachedViewport = JSON.parse(cachedKeys['session_desktop_viewport:sess-browser-101'])
        expect(cachedViewport.url).toBe('http://localhost:3000/dashboard')
    })

    it('should execute interactive browser actions like click, type, screenshot and get_console_errors', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-browser-2', {
            sessionId: 'sess-browser-102',
        })

        const actionResponses: Record<string, any> = {
            click: {
                success: true,
                action: 'click',
                output: 'Clicked element "button#login" successfully.',
                screenshotBase64: 'data:image/png;base64,clickedScreenshot',
            },
            type: {
                success: true,
                action: 'type',
                output: 'Typed "user@example.com" into element "input#email" successfully.',
                screenshotBase64: 'data:image/png;base64,typedScreenshot',
            },
            screenshot: {
                success: true,
                action: 'screenshot',
                output: 'Screenshot captured and saved to /workspace/.december/screenshots/shot.png',
                screenshotPath: '/workspace/.december/screenshots/shot.png',
                screenshotBase64: 'data:image/png;base64,fullPageScreenshot',
            },
            get_console_errors: {
                success: true,
                action: 'get_console_errors',
                output: 'No console or network errors detected.',
                consoleErrors: [],
                networkErrors: [],
            },
        }

        adapter.bash.exec = mock(async (cmd: string) => {
            for (const [actionName, mockResp] of Object.entries(actionResponses)) {
                if (cmd.includes(`"action":"${actionName}"`)) {
                    return {
                        exitCode: 0,
                        output: `DECEMBER_BROWSER_RESULT:${JSON.stringify(mockResp)}`,
                    }
                }
            }
            return { exitCode: 0, output: '' }
        }) as any

        const clickRes = await adapter.browser.action!({
            action: 'click',
            selector: 'button#login',
        })
        expect(clickRes.success).toBe(true)
        expect(clickRes.output).toContain('Clicked element "button#login"')
        expect(clickRes.screenshotBase64).toBe('data:image/png;base64,clickedScreenshot')

        const typeRes = await adapter.browser.action!({
            action: 'type',
            selector: 'input#email',
            text: 'user@example.com',
        })
        expect(typeRes.success).toBe(true)
        expect(typeRes.output).toContain('Typed "user@example.com"')

        const screenRes = await adapter.browser.action!({
            action: 'screenshot',
            fullPage: true,
        })
        expect(screenRes.success).toBe(true)
        expect(screenRes.screenshotPath).toBe('/workspace/.december/screenshots/shot.png')

        const errRes = await adapter.browser.action!({
            action: 'get_console_errors',
        })
        expect(errRes.success).toBe(true)
        expect(errRes.consoleErrors).toEqual([])
    })

    it('should handle unparseable output gracefully with sensible fallbacks without throwing', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-browser-3')

        adapter.bash.exec = mock(async () => ({
            exitCode: 0,
            output: 'Raw stdout without marker',
        })) as any

        const navResult = await adapter.browser.navigate('http://localhost:3000/fallback')
        expect(navResult.text).toBe('Raw stdout without marker')
        expect(navResult.consoleErrors).toEqual([])

        const actionResult = await adapter.browser.action!({
            action: 'click',
            selector: '.btn',
        })
        expect(actionResult.success).toBe(true)
        expect(actionResult.output).toBe('Raw stdout without marker')

        // Close should not throw
        await adapter.browser.close!()
    })
})
