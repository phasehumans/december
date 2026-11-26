import { prisma } from '@december/database'
import jwt from 'jsonwebtoken'

import { env } from '../env'
import { isAdminEmail, isAllowedAdminOrigin } from '../modules/admin/admin.utils'
import { getTokenIssuedAtMs } from '../modules/auth/auth.utils'

import { checkSignedInSession } from './auth.middleware'
import { createRateLimiter } from './rate-limiter'

import type { TokenPayload } from '../modules/auth/auth.types'
import type { NextFunction, Request, Response } from 'express'

/** An authenticator code is good for this long in one browser sign-in (T2-A). */
export const ADMIN_CODE_VALID_MS = 12 * 60 * 60 * 1000

/**
 * Leaves the admin router as if it did not exist: the request falls through to the
 * normal "Cannot GET" 404 that every unknown path gets. Nobody who is not the admin can
 * tell the admin api is there (S7).
 */
const hide = (next: NextFunction) => next('router')

/** A live, verified, not-deleted account whose email is in ADMIN_EMAILS. */
const isAdminUser = async (userId: string): Promise<boolean> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true, isDeleted: true },
    })
    return Boolean(user && !user.isDeleted && user.emailVerified && isAdminEmail(user.email))
}

/**
 * A sign-in made by the CLI. The server marks every device-flow sign-in with "cli" in its
 * user agent (pollDeviceToken), the same test describeUserAgent uses. A CLI token is the same
 * kind of JWT as a web one, so the cookie alone can't tell them apart.
 */
const isCliSession = async (sessionId: string): Promise<boolean> => {
    const session = await prisma.authSession.findUnique({
        where: { id: sessionId },
        select: { userAgent: true },
    })
    return (session?.userAgent ?? '').toLowerCase().includes('cli')
}

/**
 * The admin api accepts only the admin's web sign-in:
 * - no Bearer tokens, and no CLI sign-in even when its token is sent as a cookie (S2)
 * - only the web app's origin, so another site can't call it with the cookie (S3)
 * - a live, verified, not-deleted account listed in ADMIN_EMAILS
 * Everything else gets the plain 404. The admin's own expired or replaced token gets the
 * usual 401, so the web app refreshes it.
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.headers.authorization) return hide(next)
        if (!isAllowedAdminOrigin(req.headers.origin)) return hide(next)

        const token = req.cookies?.accessToken
        if (!token || typeof token !== 'string') return hide(next)

        let decoded: TokenPayload | string
        try {
            decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as TokenPayload | string
        } catch (err) {
            // the signature was checked before the expiry, so the user in it is real. only the
            // admin gets the 401 that makes the web app refresh; anyone else gets the 404
            if (err instanceof jwt.TokenExpiredError) {
                const payload = jwt.decode(token) as TokenPayload | null
                if (payload?.userId && (await isAdminUser(payload.userId))) {
                    return res.status(401).json({ success: false, message: 'Access token expired' })
                }
            }
            return hide(next)
        }
        if (typeof decoded === 'string' || !decoded.userId || !decoded.sessionId) {
            return hide(next)
        }

        const sessionError = await checkSignedInSession({
            userId: decoded.userId,
            sessionId: decoded.sessionId,
            issuedAtMs: getTokenIssuedAtMs(decoded),
        })
        if (sessionError === 'Token replaced' && (await isAdminUser(decoded.userId))) {
            return res.status(401).json({ success: false, message: sessionError })
        }
        if (sessionError) return hide(next)

        if (!(await isAdminUser(decoded.userId))) return hide(next)
        // S1: a CLI token sent as a cookie is still a CLI sign-in
        if (await isCliSession(decoded.sessionId)) return hide(next)

        req.user = { userId: decoded.userId, sessionId: decoded.sessionId }
        return next()
    } catch (err) {
        return next(err)
    }
}

const getVerifiedAt = async (sessionId: string): Promise<Date | null> => {
    const session = await prisma.authSession.findUnique({
        where: { id: sessionId },
        select: { adminVerifiedAt: true },
    })
    return session?.adminVerifiedAt ?? null
}

const codeRequired = (res: Response) =>
    res.status(403).json({
        success: false,
        message: 'Enter the code from your authenticator app',
        errors: { code: 'admin_code_required' },
    })

/** Runs after requireAdmin: this sign-in entered an authenticator code in the last 12 hours. */
export const requireAdminCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const verifiedAt = await getVerifiedAt(req.user!.sessionId)
        if (!verifiedAt || Date.now() - verifiedAt.getTime() > ADMIN_CODE_VALID_MS) {
            return codeRequired(res)
        }
        return next()
    } catch (err) {
        return next(err)
    }
}

const adminWriteLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    prefix: 'rl:admin:write:',
    message: 'Too many admin actions. Wait a few minutes.',
})

/** At most 60 admin changes in 15 minutes (S4.4). Reads are not limited here. */
export const limitAdminWrites = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next()
    return adminWriteLimiter(req, res, next)
}
