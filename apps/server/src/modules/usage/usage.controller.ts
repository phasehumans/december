import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { usageCheckQuerySchema } from './usage.schema'
import { usageService } from './usage.service'

import type { Request, Response } from 'express'

const getCurrentUsage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await usageService.getCurrentUsage({ userId })
    return sendSuccess(res, 'usage fetched successfully', result)
})

const checkEnoughCredits = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseQuery = usageCheckQuerySchema.parse(req.query)

    const result = await usageService.checkEnoughCredits({
        userId,
        estimatedCostInCents: parseQuery.estimatedCostInCents,
    })
    return sendSuccess(res, 'credits check successfully', result)
})

export const usageController = {
    getCurrentUsage,
    checkEnoughCredits,
}
