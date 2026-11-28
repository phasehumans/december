import { ZodError } from 'zod'

import { logger } from '../config/logger'
import { env } from '../env'
import { AppError } from '../shared/appError'

import type { Request, Response, NextFunction } from 'express'

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // a streamed answer (a search answer, a file) failed after its headers went out: no
    // JSON error can follow. Express's own handler closes the connection
    if (res.headersSent) {
        logger.error({ err, path: req.originalUrl }, 'error after the response started')
        return next(err)
    }

    const isCliRoute =
        req.originalUrl?.includes('/api/v1/cli') ||
        req.baseUrl?.includes('/api/v1/cli') ||
        req.path?.includes('/api/v1/cli')

    if (err instanceof ZodError) {
        return res.status(400).json({
            error: isCliRoute
                ? {
                      message: `Validation failed: ${JSON.stringify(err.flatten().fieldErrors)}`,
                      type: 'invalid_request_error',
                      code: '400',
                  }
                : undefined,
            success: false,
            message: 'validation failed',
            errors: err.flatten().fieldErrors,
        })
    }

    // a body the JSON parser refused (bad JSON, a bare string or number, too large) is the
    // fault of the request, not of the server
    if (
        typeof err?.type === 'string' &&
        err.type.startsWith('entity.') &&
        Number.isInteger(err.status) &&
        err.status >= 400 &&
        err.status < 500
    ) {
        return res.status(err.status).json({
            error: isCliRoute
                ? {
                      message: 'invalid request body',
                      type: 'invalid_request_error',
                      code: String(err.status),
                  }
                : undefined,
            success: false,
            message:
                err.type === 'entity.too.large' ? 'request body too large' : 'invalid request body',
        })
    }

    if (err instanceof AppError) {
        const errorType =
            err.statusCode === 401
                ? 'authentication_error'
                : err.statusCode === 402
                  ? 'insufficient_quota'
                  : 'invalid_request_error'

        return res.status(err.statusCode).json({
            error: isCliRoute
                ? {
                      message: err.message,
                      type: errorType,
                      code: String(err.statusCode),
                  }
                : undefined,
            success: false,
            message: err.message,
        })
    }

    if (env.NODE_ENV !== 'test') {
        logger.error(
            { err, reqId: req.id, url: req.url, method: req.method },
            'Unhandled Server Error'
        )
    }

    const isDev = env.NODE_ENV === 'development'
    const errorMsg = isDev ? (err instanceof Error ? err.message : String(err)) : undefined

    return res.status(500).json({
        error: isCliRoute
            ? {
                  message: errorMsg || 'internal server error',
                  type: 'server_error',
                  code: '500',
              }
            : undefined,
        success: false,
        message: 'internal server error',
        errors: errorMsg,
    })
}
