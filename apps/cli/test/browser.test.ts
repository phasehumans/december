import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { loginViaBrowser } from '../src/auth/browser'
import * as openUtils from '../src/utils/open'

describe('loginViaBrowser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('should return token and email when a valid callback is hit', async () => {
        // We mock openUrl to immediately resolve
        const mockOpenUrl = vi.spyOn(openUtils, 'openUrl').mockResolvedValue(undefined)

        let loginPromise: Promise<{ token: string; email: string | null }>

        // The test will intercept the generated URL and manually trigger the callback
        const onUrlGenerated = async (url: string) => {
            try {
                const parsedUrl = new URL(url)
                const redirectUri = parsedUrl.searchParams.get('redirect_uri')
                if (!redirectUri) {
                    throw new Error('No redirect URI found')
                }

                // Simulate the browser hitting the callback endpoint
                const callbackUrl = new URL(redirectUri)
                callbackUrl.searchParams.set('token', 'test-token-123')
                callbackUrl.searchParams.set('email', 'test@example.com')

                const response = await fetch(callbackUrl.toString())
                expect(response.status).toBe(200)
                const body = await response.text()
                expect(body).toContain('Authorized')
            } catch (err) {
                console.error(err)
            }
        }

        loginPromise = loginViaBrowser('https://mock.login', onUrlGenerated)
        const result = await loginPromise

        expect(mockOpenUrl).toHaveBeenCalledTimes(1)
        expect(result).toEqual({
            token: 'test-token-123',
            email: 'test@example.com',
        })
    })

    it('should reject when callback is missing token', async () => {
        vi.spyOn(openUtils, 'openUrl').mockResolvedValue(undefined)

        const onUrlGenerated = async (url: string) => {
            const parsedUrl = new URL(url)
            const redirectUri = parsedUrl.searchParams.get('redirect_uri')!
            const callbackUrl = new URL(redirectUri)
            // Call without setting token
            const response = await fetch(callbackUrl.toString())
            expect(response.status).toBe(400)
            const body = await response.text()
            expect(body).toBe('Missing token in callback.')
        }

        await expect(loginViaBrowser('https://mock.login', onUrlGenerated)).rejects.toThrow(
            'Missing token in callback'
        )
    })
})
