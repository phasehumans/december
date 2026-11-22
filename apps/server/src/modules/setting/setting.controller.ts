import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    updateNameSchema,
    updateNotificationSchema,
    updateOnboardingSchema,
    updateModelSourceSchema,
    submitFeedbackSchema,
} from './setting.schema'
import { settingService } from './setting.service'

import type { Request, Response } from 'express'

const getMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.getMe({ userId })
    return sendSuccess(res, 'info fetched successfully', result)
})

const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.getProfile({ userId })
    return sendSuccess(res, 'profile fetched successfully', result)
})

const updateName = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = updateNameSchema.parse(req.body)
    const { name } = parseData

    const result = await settingService.updateName({ userId, name })
    return sendSuccess(res, 'name updated successfully', result)
})

const updateNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = updateNotificationSchema.parse(req.body)
    const { notifyProjectActivity, notifyProductUpdates, notifySecurityAlerts } = parseData

    const result = await settingService.updateNotifications({
        notifyProjectActivity,
        notifyProductUpdates,
        notifySecurityAlerts,
        userId,
    })
    return sendSuccess(res, 'notifications preferences updated', result)
})

const updateModelSource = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { defaultModelSource } = updateModelSourceSchema.parse(req.body)
    const result = await settingService.updateModelSource({ userId, defaultModelSource })
    return sendSuccess(res, 'default model source updated', result)
})

const getOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.getOnboarding({ userId })
    return sendSuccess(res, 'onboarding fetched successfully', result)
})

const updateOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { step } = updateOnboardingSchema.parse(req.body)

    const result = await settingService.updateOnboarding({ userId, step })
    return sendSuccess(res, 'onboarding updated successfully', result)
})

const completeOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.completeOnboarding({ userId })
    return sendSuccess(res, 'onboarding completed successfully', result)
})

const submitFeedback = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = submitFeedbackSchema.parse(req.body)
    const { rating, feedback } = parseData

    const result = await settingService.submitFeedback({ userId, rating, feedback })
    return sendSuccess(res, 'feedback submitted successfully', result)
})

export const settingController = {
    getMe,
    getProfile,
    updateName,
    updateNotifications,
    updateModelSource,
    getOnboarding,
    updateOnboarding,
    completeOnboarding,
    submitFeedback,
}
