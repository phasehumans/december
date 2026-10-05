import { describe, expect, test, mock } from 'bun:test'

import { BrowserActionTool } from '../../src/browser_action'
import { createMockContext } from '../mock-context'

describe('BrowserActionTool (Unit)', () => {
    test('should execute navigate action and return formatted result with errors', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: mock(async () => ({ text: 'Home Page' })),
            action: mock(async (params) => ({
                success: true,
                action: 'navigate',
                text: 'Home Page',
                consoleErrors: ['[console.error] Failed to fetch user profile'],
                networkErrors: ['HTTP 401 - /api/me'],
            })),
        }

        const result = await BrowserActionTool.execute(
            { action: 'navigate', url: 'http://localhost:5173' },
            context
        )

        expect(context.operations.browser.action).toHaveBeenCalledWith({
            action: 'navigate',
            url: 'http://localhost:5173',
        })
        expect(result).toContain('Home Page')
        expect(result).toContain('[CONSOLE ERRORS]')
        expect(result).toContain('- [console.error] Failed to fetch user profile')
        expect(result).toContain('[FAILED NETWORK REQUESTS]')
        expect(result).toContain('- HTTP 401 - /api/me')
    })

    test('should execute click action successfully', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: mock(async () => ({ text: '' })),
            action: mock(async (params) => ({
                success: true,
                action: 'click',
                output: 'Clicked <BUTTON>: "Submit"',
            })),
        }

        const result = await BrowserActionTool.execute(
            { action: 'click', selector: 'button#submit' },
            context
        )

        expect(result).toBe('Clicked <BUTTON>: "Submit"')
    })

    test('should execute type action successfully', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: mock(async () => ({ text: '' })),
            action: mock(async (params) => ({
                success: true,
                action: 'type',
                output: 'Typed "test@example.com" into <INPUT> (input#email)',
            })),
        }

        const result = await BrowserActionTool.execute(
            { action: 'type', selector: 'input#email', text: 'test@example.com' },
            context
        )

        expect(result).toBe('Typed "test@example.com" into <INPUT> (input#email)')
    })

    test('should execute screenshot action and include screenshot path', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: mock(async () => ({ text: '' })),
            action: mock(async (params) => ({
                success: true,
                action: 'screenshot',
                output: 'Screenshot captured successfully.',
                screenshotPath: '/tmp/screenshot.png',
            })),
        }

        const result = await BrowserActionTool.execute(
            { action: 'screenshot', fullPage: true },
            context
        )

        expect(result).toContain('Screenshot captured successfully.')
        expect(result).toContain('[Screenshot saved: /tmp/screenshot.png]')
    })

    test('should execute get_console_errors action', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: mock(async () => ({ text: '' })),
            action: mock(async (params) => ({
                success: true,
                action: 'get_console_errors',
                output: 'Captured 1 console error(s).',
                consoleErrors: ['ReferenceError: window is not defined'],
            })),
        }

        const result = await BrowserActionTool.execute({ action: 'get_console_errors' }, context)

        expect(result).toContain('Captured 1 console error(s).')
        expect(result).toContain('[CONSOLE ERRORS]')
        expect(result).toContain('- ReferenceError: window is not defined')
    })

    test('should fallback to navigate when action method is not available', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: mock(async () => ({
                text: 'Static fallback text',
                consoleErrors: [],
                networkErrors: [],
            })),
        }

        const result = await BrowserActionTool.execute(
            { action: 'navigate', url: 'http://localhost:3000' },
            context
        )

        expect(context.operations.browser.navigate).toHaveBeenCalledWith('http://localhost:3000')
        expect(result).toBe('Static fallback text')
    })

    test('should handle action errors returned by browser operations', async () => {
        const context = createMockContext()
        context.operations.browser = {
            navigate: mock(async () => ({ text: '' })),
            action: mock(async () => ({
                success: false,
                action: 'click',
                error: 'Could not find element matching: button#nonexistent',
            })),
        }

        const result = await BrowserActionTool.execute(
            { action: 'click', selector: 'button#nonexistent' },
            context
        )

        expect(result).toContain(
            'Failed to execute action "click": Could not find element matching: button#nonexistent'
        )
    })

    test('should fail gracefully if browser operations are missing', async () => {
        const context = createMockContext()
        delete context.operations.browser

        const result = await BrowserActionTool.execute(
            { action: 'click', selector: 'button' },
            context
        )

        expect(result).toContain(
            'Failed to execute browser action: Browser operations are not supported in this environment.'
        )
    })
})
