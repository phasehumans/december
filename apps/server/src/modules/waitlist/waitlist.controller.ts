import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { WaitlistParamsSchema } from './waitlist.schema'
import { waitlistService } from './waitlist.service'

import type { Request, Response } from 'express'

const getState = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { feature } = WaitlistParamsSchema.parse(req.params)
    const result = await waitlistService.getState({ userId, feature })
    return sendSuccess(res, 'waitlist state fetched successfully', result)
})

const join = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { feature } = WaitlistParamsSchema.parse(req.params)
    const result = await waitlistService.join({ userId, feature })
    return sendSuccess(res, 'joined waitlist successfully', result)
})

const markPopupSeen = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { feature } = WaitlistParamsSchema.parse(req.params)
    const result = await waitlistService.markPopupSeen({ userId, feature })
    return sendSuccess(res, 'waitlist popup marked as seen', result)
})

export const waitlistController = {
    getState,
    join,
    markPopupSeen,
}
