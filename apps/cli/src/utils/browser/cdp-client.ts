import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export interface CdpOptions {
    chromePath: string
    headless?: boolean
    timeoutMs?: number
}

export interface CdpNavigateResult {
    text: string
    consoleErrors: string[]
    networkErrors: string[]
}

export interface CdpActionResult {
    success: boolean
    output: string
    screenshotPath?: string
    screenshotBase64?: string
    consoleErrors?: string[]
    networkErrors?: string[]
    error?: string
}

export class CdpBrowserSession {
    private chromeProc: ChildProcess | null = null
    private ws: WebSocket | null = null
    private nextId = 1
    private pendingCommands = new Map<
        number,
        { resolve: (val: any) => void; reject: (err: any) => void }
    >()
    private sessionId: string | null = null
    private tmpProfileDir: string | null = null

    public consoleErrors: string[] = []
    public networkErrors: string[] = []
    private isLoaded = false

    constructor(private options: CdpOptions) {}

    public async launch(): Promise<void> {
        this.tmpProfileDir = path.join(
            os.tmpdir(),
            `december-chrome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        )
        await fs.mkdir(this.tmpProfileDir, { recursive: true })

        const isHeadless =
            this.options.headless ??
            (process.env.DECEMBER_HEADED !== '1' && process.env.HEADED !== '1')

        const args = [
            ...(isHeadless ? ['--headless=new'] : []),
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--remote-debugging-port=0',
            '--hide-scrollbars',
            '--window-size=1280,800',
            `--user-data-dir=${this.tmpProfileDir}`,
            'about:blank',
        ]

        const proc = spawn(this.options.chromePath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        this.chromeProc = proc

        // Wait for DevTools listening on ws://...
        const wsUrl = await new Promise<string>((resolve, reject) => {
            let buffer = ''
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for Chrome DevTools WebSocket URL.'))
            }, this.options.timeoutMs || 15000)

            const onData = (chunk: Buffer) => {
                buffer += chunk.toString()
                const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/)
                if (match && match[1]) {
                    clearTimeout(timeout)
                    proc.stderr?.off('data', onData)
                    resolve(match[1])
                }
            }

            proc.stderr?.on('data', onData)
            ;(proc as any).on('error', (err: any) => {
                clearTimeout(timeout)
                reject(err)
            })
            ;(proc as any).on('exit', (code: any) => {
                clearTimeout(timeout)
                reject(new Error(`Chrome exited prematurely with code ${code}.`))
            })
        })

        // Connect WebSocket
        await this.connectWs(wsUrl)

        // Create and attach to target
        const createTargetRes = await this.sendCommand('Target.createTarget', {
            url: 'about:blank',
        })
        const targetId = createTargetRes.targetId

        const attachRes = await this.sendCommand('Target.attachToTarget', {
            targetId,
            flatten: true,
        })
        this.sessionId = attachRes.sessionId

        // Enable domains
        await this.sendSessionCommand('Page.enable')
        await this.sendSessionCommand('Runtime.enable')
        await this.sendSessionCommand('Network.enable')
    }

    private async connectWs(wsUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl)
            this.ws = ws

            ws.onopen = () => resolve()
            ws.onerror = (err) => reject(err)

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data.toString())

                    // Handle command response
                    if (typeof msg.id === 'number') {
                        const pending = this.pendingCommands.get(msg.id)
                        if (pending) {
                            this.pendingCommands.delete(msg.id)
                            if (msg.error) {
                                pending.reject(new Error(msg.error.message || 'CDP Error'))
                            } else {
                                pending.resolve(msg.result)
                            }
                        }
                        return
                    }

                    // Handle events
                    this.handleEvent(msg)
                } catch {
                    // Intentionally swallowed: invalid json from websocket
                }
            }
        })
    }

    private handleEvent(msg: any): void {
        const method = msg.method

        if (method === 'Page.loadEventFired' || method === 'Page.domContentEventFired') {
            this.isLoaded = true
        } else if (method === 'Runtime.exceptionThrown') {
            const details = msg.params?.exceptionDetails
            const desc =
                details?.exception?.description || details?.text || 'Unknown runtime exception'
            this.consoleErrors.push(`Exception: ${desc}`)
        } else if (method === 'Runtime.consoleAPICalled') {
            const type = msg.params?.type
            if (type === 'error' || type === 'warning') {
                const args = (msg.params?.args || [])
                    .map((a: any) => a.value ?? a.description ?? '')
                    .join(' ')
                this.consoleErrors.push(`[console.${type}] ${args}`)
            }
        } else if (method === 'Network.responseReceived') {
            const res = msg.params?.response
            if (res && typeof res.status === 'number' && res.status >= 400) {
                this.networkErrors.push(`HTTP ${res.status} ${res.statusText || ''} - ${res.url}`)
            }
        } else if (method === 'Network.loadingFailed') {
            const err = msg.params
            if (err) {
                this.networkErrors.push(
                    `Network failure: ${err.errorText || 'Unknown error'} (${err.type || 'request'})`
                )
            }
        }
    }

    private sendCommand(method: string, params?: Record<string, any>): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket is not open'))
            }
            const id = this.nextId++
            this.pendingCommands.set(id, { resolve, reject })
            this.ws.send(JSON.stringify({ id, method, params }))
        })
    }

    private sendSessionCommand(method: string, params?: Record<string, any>): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket is not open'))
            }
            const id = this.nextId++
            this.pendingCommands.set(id, { resolve, reject })
            const payload: any = { id, method, params }
            if (this.sessionId) {
                payload.sessionId = this.sessionId
            }
            this.ws.send(JSON.stringify(payload))
        })
    }

    public async navigate(url: string, timeoutMs = 12000): Promise<CdpNavigateResult> {
        this.consoleErrors = []
        this.networkErrors = []
        this.isLoaded = false

        await this.sendSessionCommand('Page.navigate', { url })

        // Wait for page load or timeout
        const startTime = Date.now()
        while (!this.isLoaded && Date.now() - startTime < timeoutMs) {
            await new Promise((r) => setTimeout(r, 100))
        }

        // Wait a brief moment for any deferred client-side React/Vite rendering
        await new Promise((r) => setTimeout(r, 300))

        // Extract rendered text
        const evalRes = await this.sendSessionCommand('Runtime.evaluate', {
            expression:
                '(function() { return document.body ? (document.body.innerText || document.documentElement.innerText || "") : ""; })()',
            returnByValue: true,
        })

        const text = evalRes?.result?.value || ''

        return {
            text: text.trim(),
            consoleErrors: [...this.consoleErrors],
            networkErrors: [...this.networkErrors],
        }
    }

    public async click(selector: string): Promise<CdpActionResult> {
        const expression = `
            (function(sel) {
                var el = document.querySelector(sel);
                if (!el) {
                    var buttons = Array.from(document.querySelectorAll('button, a, input[type=button], input[type=submit], [role=button]'));
                    el = buttons.find(function(b) {
                        return (b.textContent || '').trim().toLowerCase() === sel.trim().toLowerCase();
                    });
                }
                if (!el) {
                    return { success: false, error: 'Could not find element matching: ' + sel };
                }
                el.scrollIntoView({ behavior: 'instant', block: 'center' });
                el.click();
                return {
                    success: true,
                    tagName: el.tagName,
                    text: (el.textContent || '').trim().slice(0, 50)
                };
            })(${JSON.stringify(selector)})
        `

        const evalRes = await this.sendSessionCommand('Runtime.evaluate', {
            expression,
            returnByValue: true,
        })

        const result = evalRes?.result?.value
        if (!result || !result.success) {
            return {
                success: false,
                output: '',
                error: result?.error || `Element "${selector}" not found.`,
                consoleErrors: [...this.consoleErrors],
                networkErrors: [...this.networkErrors],
            }
        }

        // Wait 300ms for DOM reactions or navigation
        await new Promise((r) => setTimeout(r, 300))

        return {
            success: true,
            output: `Clicked <${result.tagName}>: "${result.text || selector}"`,
            consoleErrors: [...this.consoleErrors],
            networkErrors: [...this.networkErrors],
        }
    }

    public async type(selector: string, text: string): Promise<CdpActionResult> {
        const expression = `
            (function(sel, val) {
                var el = document.querySelector(sel);
                if (!el) {
                    var inputs = Array.from(document.querySelectorAll('input, textarea'));
                    el = inputs.find(function(i) {
                        return i.name === sel || i.id === sel || i.placeholder === sel;
                    });
                }
                if (!el) {
                    return { success: false, error: 'Could not find input element matching: ' + sel };
                }
                el.focus();
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, tagName: el.tagName, value: el.value };
            })(${JSON.stringify(selector)}, ${JSON.stringify(text)})
        `

        const evalRes = await this.sendSessionCommand('Runtime.evaluate', {
            expression,
            returnByValue: true,
        })

        const result = evalRes?.result?.value
        if (!result || !result.success) {
            return {
                success: false,
                output: '',
                error: result?.error || `Input element "${selector}" not found.`,
                consoleErrors: [...this.consoleErrors],
                networkErrors: [...this.networkErrors],
            }
        }

        return {
            success: true,
            output: `Typed "${text}" into <${result.tagName}> (${selector})`,
            consoleErrors: [...this.consoleErrors],
            networkErrors: [...this.networkErrors],
        }
    }

    public async screenshot(fullPage = false, outputPath?: string): Promise<CdpActionResult> {
        const params: any = { format: 'png' }
        if (fullPage) {
            params.captureBeyondViewport = true
        }

        const res = await this.sendSessionCommand('Page.captureScreenshot', params)
        const base64Data = res?.data
        if (!base64Data) {
            return {
                success: false,
                output: '',
                error: 'Failed to capture screenshot data from Chrome.',
            }
        }

        const targetFile =
            outputPath ||
            path.join(
                os.tmpdir(),
                `december-screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`
            )

        await fs.writeFile(targetFile, Buffer.from(base64Data, 'base64'))

        return {
            success: true,
            output: `Screenshot captured successfully.`,
            screenshotPath: targetFile,
            screenshotBase64: base64Data,
            consoleErrors: [...this.consoleErrors],
            networkErrors: [...this.networkErrors],
        }
    }

    public async getConsoleErrors(): Promise<{
        consoleErrors: string[]
        networkErrors: string[]
    }> {
        return {
            consoleErrors: [...this.consoleErrors],
            networkErrors: [...this.networkErrors],
        }
    }

    public async close(): Promise<void> {
        if (this.ws) {
            try {
                this.ws.close()
            } catch {
                // Intentionally swallowed: cleanup on close
            }
            this.ws = null
        }

        if (this.chromeProc) {
            try {
                this.chromeProc.kill('SIGTERM')
                setTimeout(() => {
                    if (this.chromeProc && !this.chromeProc.killed) {
                        this.chromeProc.kill('SIGKILL')
                    }
                }, 1000)
            } catch {
                // Intentionally swallowed: cleanup on close
            }
            this.chromeProc = null
        }

        if (this.tmpProfileDir) {
            try {
                await fs.rm(this.tmpProfileDir, { recursive: true, force: true })
            } catch {
                // Intentionally swallowed: cleanup on close
            }
            this.tmpProfileDir = null
        }
    }
}
