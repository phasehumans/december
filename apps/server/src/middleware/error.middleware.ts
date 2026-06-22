import { ZodError } from 'zod'

import { env } from '../env'
import { AppError } from '../shared/appError'

import type { Request, Response, NextFunction } from 'express'

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    // 1. Zod schema validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: err.flatten().fieldErrors,
        })
    }

    // 2. Custom AppError instances
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        })
    }

    // 3. Fallback for unhandled/unexpected errors
    console.error('Unhandled Server Error:', err)

    const isDev = env.ENV === 'DEV'
    return res.status(500).json({
        success: false,
        message: 'internal server error',
        errors: isDev ? (err instanceof Error ? err.message : String(err)) : undefined,
    })
}
