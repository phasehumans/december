import type { Response } from 'express'
import jwt, { type SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

export type TokenPayload = {
    userId: string
    sessionId: string
    iat?: number
    exp?: number
}

const ACCESS_TOKEN_COOKIE_NAME = 'accessToken'
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken'

const isProduction = process.env.NODE_ENV === 'production'

const getAccessTokenMaxAge = () => {
    return 15 * 60 * 1000 // 15 minutes
}

const getRefreshTokenMaxAge = () => {
    return 30 * 24 * 60 * 60 * 1000 // 30 days
}

const generateAccessToken = (payload: TokenPayload) => {
    const secret = process.env.ACCESS_TOKEN_SECRET

    if (!secret) {
        throw new Error('ACCESS_TOKEN_SECRET is not defined')
    }

    const expiresIn = (process.env.ACCESS_TOKEN_EXPIRES_IN || '15m') as SignOptions['expiresIn']

    return jwt.sign(
        {
            userId: payload.userId,
            sessionId: payload.sessionId,
            jti: randomUUID(),
        },
        secret,
        {
            expiresIn,
        }
    )
}

const generateRefreshToken = (payload: TokenPayload) => {
    const secret = process.env.REFRESH_TOKEN_SECRET

    if (!secret) {
        throw new Error('REFRESH_TOKEN_SECRET is not defined')
    }

    const expiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN || '30d') as SignOptions['expiresIn']

    return jwt.sign(
        {
            userId: payload.userId,
            sessionId: payload.sessionId,
            jti: randomUUID(),
        },
        secret,
        {
            expiresIn,
        }
    )
}

const verifyAccessToken = (token: string) => {
    const secret = process.env.ACCESS_TOKEN_SECRET

    if (!secret) {
        throw new Error('ACCESS_TOKEN_SECRET is not defined')
    }

    return jwt.verify(token, secret) as TokenPayload
}

const verifyRefreshToken = (token: string) => {
    const secret = process.env.REFRESH_TOKEN_SECRET

    if (!secret) {
        throw new Error('REFRESH_TOKEN_SECRET is not defined')
    }

    return jwt.verify(token, secret) as TokenPayload
}

const hashToken = async (token: string) => {
    return bcrypt.hash(token, 10)
}

const compareTokenHash = async (token: string, hashedToken: string) => {
    return bcrypt.compare(token, hashedToken)
}

const setAccessTokenCookie = (res: Response, accessToken: string) => {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: getAccessTokenMaxAge(),
        path: '/',
    })
}

const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: getRefreshTokenMaxAge(),
        path: '/',
    })
}

const clearAuthCookies = (res: Response) => {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
    })

    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
    })
}

export const authToken = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    hashToken,
    compareTokenHash,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    clearAuthCookies,
}
