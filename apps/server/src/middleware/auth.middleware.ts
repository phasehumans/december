import { prisma } from '@december/database'
import jwt from 'jsonwebtoken'

import { env } from '../env'
import { sessionCache } from '../modules/auth/auth.cache'
import { extractToken, getTokenIssuedAtMs, isTokenReplaced } from '../modules/auth/auth.utils'

import type { TokenPayload } from '../modules/auth/auth.types'
import type { Request, Response, NextFunction } from 'express'

export const parseAuthToken = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const token = extractToken(req)
        if (token) {
            const secret = env.ACCESS_TOKEN_SECRET
            const decoded = jwt.verify(token, secret) as TokenPayload | string
            if (typeof decoded !== 'string' && decoded.userId && decoded.sessionId) {
                req.tokenUser = {
                    userId: decoded.userId,
                    sessionId: decoded.sessionId,
                    issuedAtMs: getTokenIssuedAtMs(decoded),
                }
                if (!req.user) {
                    req.user = { userId: decoded.userId, sessionId: decoded.sessionId }
                }
            }
        }
    } catch (err: any) {
        req.tokenError = err
        // Intentionally swallowed: optional pre-parsing for downstream rate limiting and routing
    }
    next()
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_EXTEND_BELOW_MS = 25 * 24 * 60 * 60 * 1000

/**
 * Checks the session a valid token points to: it must exist, belong to the token's user, not
 * be revoked, expired or replaced, and the user must not be deleted. Returns the reason it
 * fails, or null. HTTP requests and socket connections both use it. A session in use is
 * extended to 30 days from now.
 */
export const checkSignedInSession = async (data: {
    userId: string
    sessionId: string
    issuedAtMs?: number
}): Promise<string | null> => {
    const { userId, sessionId, issuedAtMs } = data

    let session = await sessionCache.get(sessionId)

    if (!session) {
        session = await prisma.authSession.findUnique({
            where: {
                id: sessionId,
            },
            select: {
                id: true,
                userId: true,
                isRevoked: true,
                expiresAt: true,
                rotatedAt: true,
                user: {
                    select: {
                        id: true,
                        isDeleted: true,
                    },
                },
            },
        })

        if (session) {
            await sessionCache.set(sessionId, session)
        }
    }

    if (!session) return 'Session not found'
    if (!session.user || session.user.isDeleted) return 'Unauthorized'
    if (session.userId !== userId) return 'Invalid session'
    if (session.isRevoked) return 'Session revoked'

    const sessionExpiresAt = new Date(session.expiresAt)
    if (sessionExpiresAt < new Date()) return 'Session expired'

    // a refresh replaced this token: the client refreshes again with its current one
    if (issuedAtMs !== undefined && isTokenReplaced({ issuedAtMs, rotatedAt: session.rotatedAt })) {
        return 'Token replaced'
    }

    if (sessionExpiresAt.getTime() - Date.now() < SESSION_EXTEND_BELOW_MS) {
        const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS)
        prisma.authSession
            .update({
                where: { id: session.id },
                data: { expiresAt: newExpiresAt },
            })
            .catch(() => {
                // Intentionally swallowed: async sliding session extension
            })
        session.expiresAt = newExpiresAt
        sessionCache.set(session.id, session).catch(() => {
            // Intentionally swallowed: async session cache update
        })
    }

    return null
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const isCliRoute =
        req.originalUrl?.includes('/api/v1/cli') ||
        req.baseUrl?.includes('/api/v1/cli') ||
        req.path?.includes('/api/v1/cli')

    const sendAuthError = (status: number, message: string, errors?: any) => {
        return res.status(status).json({
            error: isCliRoute
                ? {
                      message,
                      type: 'authentication_error',
                      code: String(status),
                  }
                : undefined,
            success: false,
            message,
            ...(errors ? { errors } : {}),
        })
    }

    try {
        let tokenUser = req.tokenUser

        if (!tokenUser) {
            if (req.tokenError) {
                throw req.tokenError
            }

            const token = extractToken(req)

            if (!token) {
                return sendAuthError(401, 'Unauthorized')
            }

            const secret = env.ACCESS_TOKEN_SECRET
            const decoded = jwt.verify(token, secret) as TokenPayload | string

            if (typeof decoded === 'string' || !decoded.userId || !decoded.sessionId) {
                return sendAuthError(401, 'Invalid token')
            }

            tokenUser = {
                userId: decoded.userId,
                sessionId: decoded.sessionId,
                issuedAtMs: getTokenIssuedAtMs(decoded),
            }
            req.tokenUser = tokenUser
            if (!req.user) {
                req.user = { userId: decoded.userId, sessionId: decoded.sessionId }
            }
        }

        const sessionError = await checkSignedInSession(tokenUser)
        if (sessionError) {
            return sendAuthError(401, sessionError)
        }

        req.user = {
            userId: tokenUser.userId,
            sessionId: tokenUser.sessionId,
        }

        next()
    } catch (error: any) {
        if (error instanceof jwt.TokenExpiredError) {
            return sendAuthError(401, 'Access token expired', error.message)
        }

        if (error instanceof jwt.JsonWebTokenError) {
            return sendAuthError(401, 'Invalid token', error.message)
        }

        return sendAuthError(500, 'Internal server error', error.message)
    }
}
