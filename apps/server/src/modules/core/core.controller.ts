import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { HandlePromptSchema } from './core.schema'
import { coreService } from './core.service'

import type { Request, Response } from 'express'

const handlePrompt = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const data = HandlePromptSchema.parse(req.body)
    await coreService.processPromptJob({ userId, data })

    return sendSuccess(res, 'job enqueued', null)
})

export const coreController = {
    handlePrompt,
}
