import jwt, { type SignOptions } from 'jsonwebtoken'

type TokenPayload = {
    userId: string
    sessionId?: string
    iat?: number
    exp?: number
}

const generateAccessToken = (payload: TokenPayload) => {
    const secret = process.env.ACCESS_TOKEN_SECRET

    if (!secret) {
        throw new Error('ACCESS_TOKEN_SECRET is not defined')
    }

    const expiresIn = (process.env.ACCESS_TOKEN_EXPIRES_IN || '15m') as SignOptions['expiresIn']

    return jwt.sign(payload, secret, {
        expiresIn,
    })
}

const generateRefreshToken = (payload: TokenPayload) => {
    const secret = process.env.REFRESH_TOKEN_SECRET

    if (!secret) {
        throw new Error('REFRESH_TOKEN_SECRET is not defined')
    }

    const expiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as SignOptions['expiresIn']

    return jwt.sign(payload, secret, {
        expiresIn,
    })
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

export const authToken = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
}
