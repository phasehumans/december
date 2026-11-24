import { describe, it, expect } from 'vitest'

import {
    generatePKCE,
    getErrorHtml,
    getSuccessHtml,
    startLocalOAuthServer,
} from '../src/auth/subscriptions/oauth-server'

describe('Subscription Local OAuth Server & PKCE (Unit)', () => {
    it('generates cryptographically secure PKCE code verifier, challenge, and state', () => {
        const pkce = generatePKCE()
        expect(pkce.codeVerifier).toBeDefined()
        expect(pkce.codeChallenge).toBeDefined()
        expect(pkce.state).toBeDefined()
        expect(pkce.codeVerifier.length).toBeGreaterThan(30)
        expect(pkce.codeChallenge.length).toBeGreaterThan(30)
        expect(pkce.state.length).toBe(32)
    })

    it('spins up a local loopback server, captures redirect query parameters, and serves HTML', async () => {
        const server = await startLocalOAuthServer({ timeoutMs: 5000 })
        expect(server.port).toBeGreaterThan(0)
        expect(server.redirectUri).toBe(`http://127.0.0.1:${server.port}/callback`)

        const callbackPromise = server.waitForCallback()

        const testCode = 'auth_code_12345'
        const testState = 'state_67890'
        const callbackUrl = `${server.redirectUri}?code=${testCode}&state=${testState}`

        const res = await fetch(callbackUrl)
        expect(res.status).toBe(200)
        const html = await res.text()
        // the look of the web sign-up page: the logo and one line, no heading
        expect(html).toContain('Connected. You can close this tab.')
        expect(html).not.toContain('<h1')
        expect(html).toContain('max-width: 340px')

        const result = await callbackPromise
        expect(result.code).toBe(testCode)
        expect(result.state).toBe(testState)
    })

    it('handles OAuth error parameters from provider redirect', async () => {
        const server = await startLocalOAuthServer({ timeoutMs: 5000 })
        const callbackPromise = server.waitForCallback()

        const callbackUrl = `${server.redirectUri}?error=access_denied&error_description=User+cancelled`
        const res = await fetch(callbackUrl)
        expect(res.status).toBe(200)
        expect(await res.text()).toContain('Not connected. User cancelled.')

        const result = await callbackPromise
        expect(result.error).toBe('access_denied')
        expect(result.errorDescription).toBe('User cancelled')
    })

    it('names the plan on the page when the adapter gives one', async () => {
        const server = await startLocalOAuthServer({ timeoutMs: 5000, planName: 'ChatGPT plan' })
        const callbackPromise = server.waitForCallback()

        const html = await (await fetch(`${server.redirectUri}?code=abc&state=xyz`)).text()
        expect(html).toContain('ChatGPT plan connected. You can close this tab.')
        await callbackPromise
    })

    it('shows a failed sign-in as one red line and escapes the reason from the provider', async () => {
        expect(getErrorHtml('Claude plan', 'access_denied')).toContain(
            'Claude plan not connected. Access was denied.'
        )
        expect(getErrorHtml(undefined)).toContain(
            'Not connected. The sign-in was cancelled or failed.'
        )

        const html = getErrorHtml('Gemini plan', 'server_error', '<script>alert("x")</script>')
        expect(html).toContain('class="line error"')
        expect(html).not.toContain('<script>alert')
        expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;.')
        // only the success page tries to close its tab
        expect(html).not.toContain('window.close')
        expect(getSuccessHtml('Gemini plan')).toContain('window.close')
    })
})
