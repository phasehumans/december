import { ATTACHMENT_MAX_BYTES } from '@december/shared'
import express, { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { AppError } from '../../shared/appError'

import { attachmentController } from './attachment.controller'

import type { NextFunction, Request, Response } from 'express'

const readFile = express.raw({ type: 'application/octet-stream', limit: ATTACHMENT_MAX_BYTES })

/** reads the file from the body. a body over the cap stops here with a 413 */
const readFileBody = (req: Request, res: Response, next: NextFunction) =>
    readFile(req, res, (error?: unknown) => {
        if ((error as { type?: string } | undefined)?.type === 'entity.too.large') {
            return next(new AppError('the file is larger than 5 MB', 413))
        }
        return next(error)
    })

// mounted on /session, beside the session routes. each route names its own middleware,
// so the other /session requests pass through untouched
const attachmentRouter = Router()

attachmentRouter.post(
    '/:id/attachments',
    authMiddleware,
    readFileBody,
    attachmentController.uploadAttachment
)

attachmentRouter.delete(
    '/:id/attachments/:attachmentId',
    authMiddleware,
    attachmentController.removeAttachment
)

export default attachmentRouter
