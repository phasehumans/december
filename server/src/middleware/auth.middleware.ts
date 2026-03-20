import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization

        if (!token || Array.isArray(token)) {
            return res.status(400).json({
                success: false,
                message: 'unauthorized',
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!)

        if (typeof decoded == 'string') {
            return res.status(401).json({
                success: false,
                message: 'invalid token',
            })
        }

        req.userId = decoded.userId
        next()
    } catch (error: any) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                success: false,
                message: 'token expired',
                errors: error.message,
            })
        }

        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                success: false,
                message: 'invalid token',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'internal server error',
            errors: error.message,
        })
    }
}
