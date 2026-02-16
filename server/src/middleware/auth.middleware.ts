import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { success } from 'zod'

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
    return res.status(500).json({
      success: false,
      message: 'internal server error',
      errors: error.message,
    })
  }
}
