import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { clearLoggedInCookie, setLoggedInCookie } from '../src/shared/utils/logged-in-cookie'

describe('logged-in cookie sync', () => {
    const originalDocument = (globalThis as any).document
    const originalWindow = (globalThis as any).window
    let writes: string[] = []

    const setup = (hostname: string, protocol: string) => {
        writes = []
        ;(globalThis as any).window = { location: { hostname, protocol } }
        ;(globalThis as any).document = {
            set cookie(value: string) {
                writes.push(value)
            },
            get cookie() {
                return ''
            },
        }
    }

    beforeEach(() => {
        writes = []
    })

    afterEach(() => {
        ;(globalThis as any).document = originalDocument
        ;(globalThis as any).window = originalWindow
    })

    it('sets the flag on the shared trydecember.com domain in production', () => {
        setup('app.trydecember.com', 'https:')
        setLoggedInCookie()
        expect(writes).toHaveLength(1)
        expect(writes[0]).toStartWith('december_logged_in=1;')
        expect(writes[0]).toContain('Domain=.trydecember.com')
        expect(writes[0]).toContain('Max-Age=2592000')
        expect(writes[0]).toContain('Secure')
    })

    it('sets a host-only, non-secure flag on localhost', () => {
        setup('localhost', 'http:')
        setLoggedInCookie()
        expect(writes).toHaveLength(1)
        expect(writes[0]).not.toContain('Domain=')
        expect(writes[0]).not.toContain('Secure')
    })

    it('clears both the shared-domain and host-only variants in production', () => {
        setup('app.trydecember.com', 'https:')
        clearLoggedInCookie()
        expect(writes).toHaveLength(2)
        expect(writes[0]).toContain('Domain=.trydecember.com')
        expect(writes[0]).toContain('Max-Age=0')
        expect(writes[1]).not.toContain('Domain=')
        expect(writes[1]).toContain('Max-Age=0')
    })
})
