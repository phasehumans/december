import crypto from 'node:crypto'
import http from 'node:http'

import type { AddressInfo } from 'node:net'

export interface PKCEPair {
    codeVerifier: string
    codeChallenge: string
    state: string
}

export function generatePKCE(): PKCEPair {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    const state = crypto.randomBytes(16).toString('hex')
    return { codeVerifier, codeChallenge, state }
}

// the two pages the browser shows after a plan sign-in. they follow the web sign-up page:
// the 36px logo and one line under it, grey when connected, red when not. the cli serves
// them from the user's computer, so the style is written here and not shared with the web app.

const DECEMBER_LOGO_SVG = `<svg class="logo" viewBox="5 4 14 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <line x1="12" y1="12" x2="12" y2="5.3" />
  <line x1="12" y1="7.5" x2="13.9" y2="6.4" />
  <line x1="12" y1="7.5" x2="10.1" y2="6.4" />
  <line x1="12" y1="12" x2="17.8" y2="8.65" />
  <line x1="15.9" y1="9.75" x2="17.8" y2="10.85" />
  <line x1="15.9" y1="9.75" x2="15.9" y2="7.55" />
  <line x1="12" y1="12" x2="17.8" y2="15.35" />
  <line x1="15.9" y1="14.25" x2="15.9" y2="16.45" />
  <line x1="15.9" y1="14.25" x2="17.8" y2="13.15" />
  <line x1="12" y1="12" x2="12" y2="18.7" />
  <line x1="12" y1="16.5" x2="10.1" y2="17.6" />
  <line x1="12" y1="16.5" x2="13.9" y2="17.6" />
  <line x1="12" y1="12" x2="6.2" y2="15.35" />
  <line x1="8.1" y1="14.25" x2="6.2" y2="13.15" />
  <line x1="8.1" y1="14.25" x2="8.1" y2="16.45" />
  <line x1="12" y1="12" x2="6.2" y2="8.65" />
  <line x1="8.1" y1="9.75" x2="8.1" y2="7.55" />
  <line x1="8.1" y1="9.75" x2="6.2" y2="10.85" />
</svg>`

const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** the provider's reason as one sentence */
const failureReason = (error?: string, errorDescription?: string): string => {
    const reason = (errorDescription || error || '').trim()
    if (!reason) return 'The sign-in was cancelled or failed.'
    if (reason === 'access_denied') return 'Access was denied.'
    return /[.!?]$/.test(reason) ? reason : `${reason}.`
}

function renderPage(page: { line: string; isError: boolean }): string {
    // the tab can close itself only when the browser allows it, so the line also says it
    const closeScript = page.isError
        ? ''
        : '\n  <script>\n    setTimeout(() => { window.close(); }, 3000);\n  </script>'

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>December CLI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&display=swap">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #141414;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .container {
      width: 100%;
      max-width: 340px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .logo {
      width: 36px;
      height: 36px;
      color: #ffffff;
    }
    .line {
      margin-top: 12px;
      font-size: 13px;
      line-height: 1.6;
      color: #888888;
    }
    .line.error {
      color: #f87171;
    }
  </style>
</head>
<body>
  <div class="container">
    ${DECEMBER_LOGO_SVG}
    <p class="line${page.isError ? ' error' : ''}"${page.isError ? ' role="alert"' : ''}>${escapeHtml(page.line)}</p>
  </div>${closeScript}
</body>
</html>`
}

/** "ChatGPT plan connected. You can close this tab." */
export function getSuccessHtml(planName?: string): string {
    const subject = planName ? `${planName} connected` : 'Connected'
    return renderPage({ line: `${subject}. You can close this tab.`, isError: false })
}

/** "ChatGPT plan not connected. Access was denied." */
export function getErrorHtml(planName?: string, error?: string, errorDescription?: string): string {
    const subject = planName ? `${planName} not connected` : 'Not connected'
    return renderPage({
        line: `${subject}. ${failureReason(error, errorDescription)}`,
        isError: true,
    })
}

export interface LocalOAuthServerOptions {
    /** named on the page after the sign-in, for example 'ChatGPT plan' */
    planName?: string
    timeoutMs?: number
    path?: string
    port?: number
    host?: string
    redirectHost?: string
    redirectUri?: string
}

export interface LocalOAuthResult {
    code?: string
    state?: string
    error?: string
    errorDescription?: string
    params: Record<string, string>
}

export async function startLocalOAuthServer(options?: LocalOAuthServerOptions): Promise<{
    port: number
    redirectUri: string
    waitForCallback: () => Promise<LocalOAuthResult>
    close: () => Promise<void>
}> {
    const callbackPath = options?.path || '/callback'
    const timeoutMs = options?.timeoutMs || 120000 // 2 minutes default

    let serverInstance: http.Server | null = null
    let serverClosed = false

    const serverPromise = new Promise<{
        port: number
        redirectUri: string
        waitForCallback: () => Promise<LocalOAuthResult>
        close: () => Promise<void>
    }>((resolveServer, rejectServer) => {
        const server = http.createServer()
        serverInstance = server

        let callbackPromiseResolve: (res: LocalOAuthResult) => void
        let callbackPromiseReject: (err: Error) => void

        const callbackPromise = new Promise<LocalOAuthResult>((resolve, reject) => {
            callbackPromiseResolve = resolve
            callbackPromiseReject = reject
        })

        const timer = setTimeout(() => {
            if (!serverClosed) {
                cleanupServer()
                callbackPromiseReject(
                    new Error('OAuth authentication timed out waiting for browser authorization.')
                )
            }
        }, timeoutMs)

        const cleanupServer = async () => {
            if (serverClosed) return
            serverClosed = true
            clearTimeout(timer)
            try {
                await new Promise<void>((r) => server.close(() => r()))
            } catch {
                // Intentionally swallowed: server already closed
            }
        }

        server.on('request', (req, res) => {
            const reqUrl = req.url || '/'
            const parsedUrl = new URL(reqUrl, 'http://127.0.0.1')

            if (parsedUrl.pathname === callbackPath) {
                const queryParams: Record<string, string> = {}
                for (const [key, value] of parsedUrl.searchParams.entries()) {
                    queryParams[key] = value
                }

                const code = queryParams.code
                const state = queryParams.state
                const error = queryParams.error
                const errorDescription =
                    queryParams.error_description || queryParams.errorDescription

                const htmlResponse = error
                    ? getErrorHtml(options?.planName, error, errorDescription)
                    : getSuccessHtml(options?.planName)

                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    Connection: 'close',
                })
                res.end(htmlResponse)

                cleanupServer().finally(() => {
                    callbackPromiseResolve({
                        code,
                        state,
                        error,
                        errorDescription,
                        params: queryParams,
                    })
                })
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' })
                res.end('Not Found')
            }
        })

        server.on('error', (err) => {
            clearTimeout(timer)
            rejectServer(err)
        })

        const listenPort = options?.port !== undefined ? options.port : 0
        const listenHost = options?.host || '127.0.0.1'

        server.listen(listenPort, listenHost, () => {
            const address = server.address() as AddressInfo
            const port = address.port
            const hostForUri =
                options?.redirectHost || (listenHost === '0.0.0.0' ? 'localhost' : listenHost)
            const redirectUri =
                options?.redirectUri || `http://${hostForUri}:${port}${callbackPath}`

            resolveServer({
                port,
                redirectUri,
                waitForCallback: () => callbackPromise,
                close: cleanupServer,
            })
        })
    })

    return serverPromise
}
