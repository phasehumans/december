import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    removeAttachmentParamsSchema,
    uploadAttachmentParamsSchema,
    uploadAttachmentQuerySchema,
} from './attachment.schema'
import { attachmentService } from './attachment.service'

import type { Request, Response } from 'express'

const uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { id } = uploadAttachmentParamsSchema.parse(req.params)
    const { name } = uploadAttachmentQuerySchema.parse(req.query)
    // the body is the file itself. any other content type leaves no bytes here
    if (!Buffer.isBuffer(req.body)) {
        throw new AppError('send the file as application/octet-stream', 400)
    }

    const attachment = await attachmentService.uploadAttachment({
        userId,
        sessionId: id,
        name,
        content: req.body,
    })
    return sendSuccess(res, 'attachment uploaded successfully', { attachment }, 201)
})

const removeAttachment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { id, attachmentId } = removeAttachmentParamsSchema.parse(req.params)
    await attachmentService.removeAttachment({ userId, sessionId: id, attachmentId })
    return sendSuccess(res, 'attachment removed successfully', null)
})

export const attachmentController = {
    uploadAttachment,
    removeAttachment,
}
