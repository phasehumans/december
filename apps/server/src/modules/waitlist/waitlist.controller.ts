import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { LaunchWaitlistSchema, WaitlistParamsSchema } from './waitlist.schema'
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

const listEntries = asyncHandler(async (req: Request, res: Response) => {
    const { feature } = WaitlistParamsSchema.parse(req.params)
    const result = await waitlistService.listEntries({ feature })
    return sendSuccess(res, 'waitlist entries fetched successfully', result)
})

const launch = asyncHandler(async (req: Request, res: Response) => {
    const adminUserId = req.user?.userId as string | undefined

    if (!adminUserId) {
        throw new AppError('unauthorized', 401)
    }

    const { feature } = WaitlistParamsSchema.parse(req.params)
    const { subject, body, inboxMessage } = LaunchWaitlistSchema.parse(req.body)
    const result = await waitlistService.launch({
        adminUserId,
        feature,
        subject,
        body,
        inboxMessage,
    })
    return sendSuccess(res, 'waitlist launch sent', result)
})

export const waitlistController = {
    getState,
    join,
    markPopupSeen,
    listEntries,
    launch,
}
