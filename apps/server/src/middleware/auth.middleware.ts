import { prisma } from '@december/database'
import jwt from 'jsonwebtoken'

import type { TokenPayload } from '../modules/auth/auth.utils'
import type { Request, Response, NextFunction } from 'express'

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token: string | undefined

        const authHeader = req.headers.authorization

        if (authHeader && !Array.isArray(authHeader)) {
            const [scheme, extractedToken] = authHeader.split(' ')
            if (scheme === 'Bearer' && extractedToken) {
                token = extractedToken
            }
        }

        if (!token) {
            token = req.cookies?.accessToken
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            })
        }

        const secret = process.env.ACCESS_TOKEN_SECRET

        if (!secret) {
            return res.status(500).json({
                success: false,
                message: 'ACCESS_TOKEN_SECRET is not configured',
            })
        }

        const decoded = jwt.verify(token, secret) as TokenPayload | string

        if (typeof decoded === 'string') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
            })
        }

        const session = await prisma.session.findUnique({
            where: {
                id: decoded.sessionId,
            },
            select: {
                id: true,
                userId: true,
                isRevoked: true,
                expiresAt: true,
                user: {
                    select: {
                        id: true,
                        isDeleted: true,
                    },
                },
            },
        })

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Session not found',
            })
        }

        if (!session.user || session.user.isDeleted) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            })
        }

        if (session.userId !== decoded.userId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid session',
            })
        }

        if (session.isRevoked) {
            return res.status(401).json({
                success: false,
                message: 'Session revoked',
            })
        }

        if (session.expiresAt < new Date()) {
            return res.status(401).json({
                success: false,
                message: 'Session expired',
            })
        }

        req.user = {
            userId: decoded.userId,
            sessionId: decoded.sessionId,
        }

        next()
    } catch (error: any) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                success: false,
                message: 'Access token expired',
                errors: error.message,
            })
        }

        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            errors: error.message,
        })
    }
}
