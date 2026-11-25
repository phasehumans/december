import crypto from 'crypto'

import jwt, { type SignOptions } from 'jsonwebtoken'

import { env } from '../../env'
import { emailService } from '../email/email.service'

import type { SignedInSessionKind, TokenPayload } from './auth.types'
import type { OtpType } from './templates/otp.template'

export const hashRefreshToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export const getNameFromEmail = (email: string): string => {
    if (!email) return ''
    const parts = email.split('@')
    if (parts.length < 2 || !parts[0]) return ''
    const localPart = parts[0]
    return localPart.replace(/\d/g, '')
}

export const generateUserCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `${result.substring(0, 4)}-${result.substring(4, 8)}`
}

export const sendOTP = async (email: string, otp: string, type: OtpType = 'signup') => {
    await emailService.sendOtpEmail({ to: email, otp, type })
}

export const sendWelcomeEmail = async (email: string, name: string) => {
    await emailService.sendWelcomeEmail({ to: email, name })
}

export const generateAccessToken = (
    payload: TokenPayload,
    options?: { expiresIn?: SignOptions['expiresIn'] }
) => {
    const secret = env.ACCESS_TOKEN_SECRET
    const expiresIn = (options?.expiresIn ||
        env.ACCESS_TOKEN_EXPIRES_IN) as SignOptions['expiresIn']

    return jwt.sign(
        {
            userId: payload.userId,
            sessionId: payload.sessionId,
            jti: crypto.randomUUID(),
        },
        secret,
        {
            expiresIn,
        }
    )
}

export const generateRefreshToken = (payload: TokenPayload) => {
    return generateAccessToken(payload)
}

export const verifyAccessToken = (token: string) => {
    const secret = env.ACCESS_TOKEN_SECRET
    return jwt.verify(token, secret) as unknown as TokenPayload
}

export const verifyRefreshToken = (token: string) => {
    const secret = env.ACCESS_TOKEN_SECRET || env.REFRESH_TOKEN_SECRET || ''
    return jwt.verify(token, secret) as unknown as TokenPayload
}

export const extractToken = (req: {
    headers: Record<string, any>
    cookies?: Record<string, any>
}): string | undefined => {
    const authHeader = req.headers.authorization
    if (authHeader && typeof authHeader === 'string') {
        const [scheme, extractedToken] = authHeader.split(' ')
        if (scheme === 'Bearer' && extractedToken) {
            return extractedToken
        }
    }
    return req.cookies?.accessToken
}

const BROWSERS: [RegExp, string][] = [
    [/Edg\//, 'Edge'],
    [/OPR\//, 'Opera'],
    [/Firefox\/|FxiOS\//, 'Firefox'],
    [/Chrome\/|CriOS\//, 'Chrome'],
    [/Safari\//, 'Safari'],
]

// iPhone and Android come before Linux and macOS: their user agents name those too
const SYSTEMS: [RegExp, string][] = [
    [/iPhone/, 'iPhone'],
    [/iPad/, 'iPad'],
    [/Android/, 'Android'],
    [/Windows|win32/i, 'Windows'],
    [/Mac OS X|Macintosh|darwin/i, 'macOS'],
    [/Linux|linux/, 'Linux'],
]

const firstMatch = (value: string, list: [RegExp, string][]) =>
    list.find(([pattern]) => pattern.test(value))?.[1]

/**
 * A short name for a signed-in device, from the user agent the session was made with:
 * "Chrome on Windows", "December CLI on Linux". CLI sessions have "cli" in the user agent
 * (see pollDeviceToken), the same test as findActiveDeviceSession.
 */
export const describeUserAgent = (
    userAgent: string | null | undefined
): { label: string; kind: SignedInSessionKind } => {
    const value = userAgent ?? ''
    const system = firstMatch(value, SYSTEMS)

    if (value.toLowerCase().includes('cli')) {
        return { kind: 'cli', label: system ? `December CLI on ${system}` : 'December CLI' }
    }

    const browser = firstMatch(value, BROWSERS) ?? 'Browser'
    return { kind: 'web', label: system ? `${browser} on ${system}` : browser }
}
