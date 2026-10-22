import { expect, test, describe, afterEach } from 'bun:test'

import {
    getApiBaseUrl,
    getClientEnv,
    getGithubClientId,
    getGithubAppName,
    getGoogleClientId,
    getVercelIntegrationSlug,
} from '../src/shared/config/env'

describe('API Client Base URL and Environment Configuration', () => {
    const originalWindow = (globalThis as any).window

    afterEach(() => {
        if (originalWindow !== undefined) {
            ;(globalThis as any).window = originalWindow
        } else {
            delete (globalThis as any).window
        }
    })

    test('resolves production API URL when window hostname is trydecember.com', () => {
        ;(globalThis as any).window = {
            location: {
                hostname: 'trydecember.com',
                origin: 'https://trydecember.com',
            },
        }

        expect(getApiBaseUrl()).toBe('https://api.trydecember.com/api/v1')
    })

    test('resolves production API URL for subdomains of trydecember.com', () => {
        ;(globalThis as any).window = {
            location: {
                hostname: 'app.trydecember.com',
                origin: 'https://app.trydecember.com',
            },
        }

        expect(getApiBaseUrl()).toBe('https://api.trydecember.com/api/v1')
    })

    test('resolves same-origin API URL for custom/staging domains', () => {
        ;(globalThis as any).window = {
            location: {
                hostname: 'december-staging.internal',
                origin: 'https://december-staging.internal',
            },
        }

        expect(getApiBaseUrl()).toBe('https://december-staging.internal/api/v1')
    })

    test('reads runtime window.__ENV__ injection when present', () => {
        ;(globalThis as any).window = {
            __ENV__: {
                GITHUB_CLIENT_ID: 'custom-gh-client-id',
                VERCEL_INTEGRATION_SLUG: 'custom-slug',
            },
            location: {
                hostname: 'localhost',
                origin: 'http://localhost:3000',
            },
        }

        expect(getClientEnv('GITHUB_CLIENT_ID')).toBe('custom-gh-client-id')
        expect(getGithubClientId()).toBe('custom-gh-client-id')
        expect(getVercelIntegrationSlug()).toBe('custom-slug')
    })

    test('falls back to default integration values when env is unset', () => {
        ;(globalThis as any).window = {
            location: {
                hostname: 'localhost',
                origin: 'http://localhost:3000',
            },
        }

        expect(getGithubClientId()).toBe('Iv23liFEvEZntQIz6Enc')
        expect(getGithubAppName()).toBe('trydecember')
        expect(getGoogleClientId()).toBe(
            '762203307362-qg77ln4ci9eldv3i0q1smv804epsbhk0.apps.googleusercontent.com'
        )
        expect(getVercelIntegrationSlug()).toBe('december')
    })

    test('refreshAuthSession retries on 502/network downtime and succeeds when available', async () => {
        const { refreshAuthSession } = await import('../src/shared/api/client')
        const originalFetch = globalThis.fetch
        let callCount = 0

        globalThis.fetch = (async (url: string | URL | Request, init?: any) => {
            const urlStr =
                typeof url === 'string' ? url : url instanceof Request ? url.url : url.toString()
            if (urlStr.includes('/auth/refresh')) {
                callCount++
                if (callCount === 1) {
                    return new Response(JSON.stringify({ message: 'Bad Gateway' }), { status: 502 })
                }
                return new Response(JSON.stringify({ success: true }), { status: 200 })
            }
            return originalFetch ? originalFetch(url, init) : new Response('{}', { status: 200 })
        }) as any

        try {
            const result = await refreshAuthSession(2)
            expect(result).toBe(true)
            expect(callCount).toBe(2)
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    test('refreshAuthSession does not retry on 401 unauthorized', async () => {
        const { refreshAuthSession } = await import('../src/shared/api/client')
        const originalFetch = globalThis.fetch
        let callCount = 0

        globalThis.fetch = (async (url: string | URL | Request, init?: any) => {
            const urlStr =
                typeof url === 'string' ? url : url instanceof Request ? url.url : url.toString()
            if (urlStr.includes('/auth/refresh')) {
                callCount++
                return new Response(JSON.stringify({ message: 'Session expired' }), { status: 401 })
            }
            return originalFetch ? originalFetch(url, init) : new Response('{}', { status: 200 })
        }) as any

        try {
            const result = await refreshAuthSession(2)
            expect(result).toBe(false)
            expect(callCount).toBe(1)
        } finally {
            globalThis.fetch = originalFetch
        }
    })
})
