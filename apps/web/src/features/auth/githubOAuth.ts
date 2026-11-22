// GitHub login sends the whole tab to github.com and back to /github/callback.
// sessionStorage survives that round trip in the same tab, so it carries the
// CSRF state and the page the user should land on afterwards.

const STATE_KEY = 'december:github-oauth-state'
const RETURN_KEY = 'december:github-oauth-return'
const CALLBACK_PATH = '/github/callback'

const isSafeReturnPath = (path: string | null | undefined): path is string => {
    return (
        typeof path === 'string' &&
        path.startsWith('/') &&
        !path.startsWith('//') &&
        !path.startsWith('/\\') &&
        !path.startsWith(CALLBACK_PATH)
    )
}

const createNonce = () => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// /login and /signup show the auth modal even when signed in, so going back
// there would loop. Use their ?redirect= target instead.
const getReturnPath = (location: Pick<Location, 'pathname' | 'search'>) => {
    const { pathname, search } = location
    if (pathname === '/login' || pathname === '/signup') {
        const redirectTarget = new URLSearchParams(search).get('redirect')
        return isSafeReturnPath(redirectTarget) ? redirectTarget : '/'
    }
    const current = `${pathname}${search}`
    return isSafeReturnPath(current) ? current : '/'
}

const begin = (location: Pick<Location, 'pathname' | 'search'>) => {
    const state = `auth.${createNonce()}`
    sessionStorage.setItem(STATE_KEY, state)
    sessionStorage.setItem(RETURN_KEY, getReturnPath(location))
    return state
}

// Reads and clears the stored values, so a state can only be used once.
const complete = (returnedState: string | null) => {
    const expectedState = sessionStorage.getItem(STATE_KEY)
    const storedReturn = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(RETURN_KEY)

    return {
        isStateValid: Boolean(expectedState) && returnedState === expectedState,
        returnPath: isSafeReturnPath(storedReturn) ? storedReturn : '/',
    }
}

export const githubOAuth = {
    begin,
    complete,
    getReturnPath,
    isSafeReturnPath,
}
