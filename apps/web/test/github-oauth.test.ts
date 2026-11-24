import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { beforeEach, describe, expect, test } from 'bun:test'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { githubOAuth } = await import('../src/features/auth/githubOAuth')

const at = (pathname: string, search = '') => ({ pathname, search })

describe('github oauth state and return path', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    test('begin creates a fresh random state each time', () => {
        const first = githubOAuth.begin(at('/'))
        const second = githubOAuth.begin(at('/'))
        expect(first).toMatch(/^auth\.[0-9a-f]{32}$/)
        expect(second).not.toBe(first)
    })

    test('complete accepts the stored state once and returns the start page', () => {
        const state = githubOAuth.begin(at('/activate', '?code=ABCD-EFGH'))

        expect(githubOAuth.complete(state)).toEqual({
            isStateValid: true,
            returnPath: '/activate?code=ABCD-EFGH',
        })
        // replaying the same callback fails: the state was consumed
        expect(githubOAuth.complete(state).isStateValid).toBe(false)
    })

    test('complete rejects a state that this tab did not start', () => {
        githubOAuth.begin(at('/'))
        expect(githubOAuth.complete('auth.attacker').isStateValid).toBe(false)
    })

    test('complete rejects any state when no login was started', () => {
        expect(githubOAuth.complete('auth').isStateValid).toBe(false)
        expect(githubOAuth.complete(null).isStateValid).toBe(false)
    })

    test('login and signup pages return to their safe redirect target', () => {
        expect(githubOAuth.getReturnPath(at('/login', '?redirect=/settings'))).toBe('/settings')
        expect(githubOAuth.getReturnPath(at('/signup'))).toBe('/')
        expect(githubOAuth.getReturnPath(at('/login', '?redirect=//evil.com'))).toBe('/')
        expect(githubOAuth.getReturnPath(at('/login', '?redirect=https://evil.com'))).toBe('/')
    })

    test('paths that browsers turn into another origin are rejected', () => {
        // browsers drop tab and newline characters, so these become //evil.com
        expect(githubOAuth.getReturnPath(at('/login', '?redirect=%2F%09%2Fevil.com'))).toBe('/')
        expect(githubOAuth.getReturnPath(at('/login', '?redirect=%2F%0A%2Fevil.com'))).toBe('/')
        expect(githubOAuth.getReturnPath(at('/login', '?redirect=%2F%0D%2Fevil.com'))).toBe('/')
        expect(githubOAuth.isSafeReturnPath('/\t/evil.com')).toBe(false)
        expect(githubOAuth.isSafeReturnPath('/\\evil.com')).toBe(false)
        expect(githubOAuth.isSafeReturnPath('/settings?tab=keys')).toBe(true)
    })

    test('device activation keeps its code in the return path', () => {
        expect(githubOAuth.getReturnPath(at('/device/activate', '?code=ABCD-1234'))).toBe(
            '/device/activate?code=ABCD-1234'
        )
    })

    test('a tampered stored return path falls back to home', () => {
        const state = githubOAuth.begin(at('/'))
        sessionStorage.setItem('december:github-oauth-return', 'https://evil.com')
        expect(githubOAuth.complete(state).returnPath).toBe('/')
    })
})
