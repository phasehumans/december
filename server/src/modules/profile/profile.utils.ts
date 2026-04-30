import type { Response } from 'express'

export const extractFirstName = (fullname: string) => {
    return fullname.trim().split(/\s+/)[0] || 'Profile'
}

const ACCESS_TOKEN_COOKIE_NAME = 'accessToken'
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken'

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
}

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 min
    })

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    })
}

const clearAuthCookies = (res: Response) => {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, cookieOptions)
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, cookieOptions)
}

export default {
    setAuthCookies,
    clearAuthCookies,
}
