import { CdpBrowserSession } from './cdp-client'
import { findSystemChrome } from './detector'

import type {
    BrowserActionInput,
    BrowserActionResult,
    BrowserNavigateResult,
} from '@december/shared'

class BrowserRunner {
    private activeSession: CdpBrowserSession | null = null
    private cleanupRegistered = false

    private registerCleanup(): void {
        if (this.cleanupRegistered) return
        this.cleanupRegistered = true

        const cleanup = () => {
            if (this.activeSession) {
                this.activeSession.close().catch(() => {
                    // Intentionally swallowed: process exit cleanup
                })
                this.activeSession = null
            }
        }

        process.once('exit', cleanup)
        process.once('SIGINT', cleanup)
        process.once('SIGTERM', cleanup)
    }

    public async getSession(): Promise<CdpBrowserSession | null> {
        if (this.activeSession) {
            return this.activeSession
        }

        const chromePath = await findSystemChrome()
        if (!chromePath) {
            return null
        }

        try {
            const { loadConfig } = await import('../../config')
            const config = await loadConfig().catch(() => null)

            const hasDisplay =
                process.platform !== 'linux' ||
                Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)

            const isVisible =
                hasDisplay &&
                config?.browserVisible !== false &&
                process.env.HEADED !== '0' &&
                process.env.DECEMBER_HEADED !== '0'

            const session = new CdpBrowserSession({
                chromePath,
                headless: !isVisible,
            })
            await session.launch()
            this.activeSession = session
            this.registerCleanup()
            return session
        } catch {
            // Intentionally swallowed: fallback to null if launch failed
            return null
        }
    }

    public async staticFallbackFetch(url: string): Promise<BrowserNavigateResult> {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DecemberAgent/1.0)',
                },
            })
            const html = await res.text()

            if (!res.ok) {
                return {
                    text: '',
                    error: `HTTP Error (${res.status}): ${html}`,
                    networkErrors: [`HTTP ${res.status} - ${url}`],
                }
            }

            const cleanText = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()

            const notice =
                '\n\n[Note: Local Chrome/Chromium not detected. Displaying static HTML text. Install Chrome or Chromium for client-side JavaScript rendering and interactive actions.]'

            return {
                text: cleanText + notice,
                consoleErrors: [],
                networkErrors: [],
            }
        } catch (err: any) {
            return {
                text: '',
                error: err.message,
                networkErrors: [`Network request failed: ${err.message}`],
            }
        }
    }

    public navigate = async (url: string): Promise<BrowserNavigateResult> => {
        const session = await this.getSession()
        if (session) {
            try {
                return await session.navigate(url)
            } catch {
                // Intentionally swallowed: fallback to static fetch if navigation throws in CDP
            }
        }

        return this.staticFallbackFetch(url)
    }

    public action = async (params: BrowserActionInput): Promise<BrowserActionResult> => {
        const { action, url, selector, text, fullPage } = params

        // Action: navigate
        if (action === 'navigate') {
            if (!url) {
                return {
                    success: false,
                    action: 'navigate',
                    error: 'Action "navigate" requires a valid "url" parameter.',
                }
            }
            const navResult = await this.navigate(url)
            if (navResult.error) {
                return {
                    success: false,
                    action: 'navigate',
                    error: navResult.error,
                    networkErrors: navResult.networkErrors,
                }
            }
            return {
                success: true,
                action: 'navigate',
                text: navResult.text,
                consoleErrors: navResult.consoleErrors,
                networkErrors: navResult.networkErrors,
            }
        }

        // Action: get_console_errors
        if (action === 'get_console_errors') {
            if (this.activeSession) {
                const errors = await this.activeSession.getConsoleErrors()
                const count = errors.consoleErrors.length + errors.networkErrors.length
                return {
                    success: true,
                    action: 'get_console_errors',
                    output:
                        count > 0
                            ? `Captured ${errors.consoleErrors.length} console error(s) and ${errors.networkErrors.length} network error(s).`
                            : 'No console or network errors detected.',
                    consoleErrors: errors.consoleErrors,
                    networkErrors: errors.networkErrors,
                }
            }
            return {
                success: true,
                action: 'get_console_errors',
                output: 'No active browser session running.',
            }
        }

        // Actions requiring Chrome: click, type, screenshot
        const session = await this.getSession()
        if (!session) {
            return {
                success: false,
                action,
                error: `Interactive browser action "${action}" requires Google Chrome or Chromium. Please install Chrome or Chromium, or set the CHROME_PATH environment variable.`,
            }
        }

        switch (action) {
            case 'click': {
                if (!selector) {
                    return {
                        success: false,
                        action: 'click',
                        error: 'Action "click" requires a "selector" parameter.',
                    }
                }
                const res = await session.click(selector)
                return {
                    success: res.success,
                    action: 'click',
                    output: res.output,
                    error: res.error,
                    consoleErrors: res.consoleErrors,
                    networkErrors: res.networkErrors,
                }
            }
            case 'type': {
                if (!selector) {
                    return {
                        success: false,
                        action: 'type',
                        error: 'Action "type" requires a "selector" parameter.',
                    }
                }
                const res = await session.type(selector, text || '')
                return {
                    success: res.success,
                    action: 'type',
                    output: res.output,
                    error: res.error,
                    consoleErrors: res.consoleErrors,
                    networkErrors: res.networkErrors,
                }
            }
            case 'screenshot': {
                const res = await session.screenshot(Boolean(fullPage))
                return {
                    success: res.success,
                    action: 'screenshot',
                    output: res.output,
                    screenshotPath: res.screenshotPath,
                    screenshotBase64: res.screenshotBase64,
                    error: res.error,
                    consoleErrors: res.consoleErrors,
                    networkErrors: res.networkErrors,
                }
            }
            default:
                return {
                    success: false,
                    action,
                    error: `Unsupported browser action: ${action}`,
                }
        }
    }

    public close = async (): Promise<void> => {
        if (this.activeSession) {
            await this.activeSession.close()
            this.activeSession = null
        }
    }
}

export const browserRunner = new BrowserRunner()
