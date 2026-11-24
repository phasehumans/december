import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    updateNameSchema,
    updateNotificationSchema,
    updateOnboardingSchema,
    updateModelSourceSchema,
    submitFeedbackSchema,
    unsubscribeQuerySchema,
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

// the link in announcement emails opens a browser page, so these two answer with html,
// not json. the GET only asks; link scanners that open it change nothing
const unsubscribePage = (content: string) =>
    `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Unsubscribe</title></head><body style="font-family: system-ui, sans-serif; background: #141414; color: #ededed; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">${content}</body></html>`

const escapeAttr = (value: string) => value.replace(/[^A-Za-z0-9-]/g, '')

const showUnsubscribe = asyncHandler(async (req: Request, res: Response) => {
    const { u, t } = unsubscribeQuerySchema.parse(req.query)
    await settingService.checkUnsubscribe({ userId: u, token: t })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res
        .status(200)
        .send(
            unsubscribePage(
                `<form method="post" style="display: flex; flex-direction: column; align-items: center; gap: 16px;"><p style="margin: 0;">Stop product emails from December?</p><input type="hidden" name="u" value="${escapeAttr(u)}" /><input type="hidden" name="t" value="${escapeAttr(t)}" /><button type="submit" style="font: inherit; padding: 8px 16px; border-radius: 6px; border: 0; background: #ededed; color: #141414; cursor: pointer;">Unsubscribe</button></form>`
            )
        )
})

const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
    const { u, t } = unsubscribeQuerySchema.parse(req.body)
    await settingService.unsubscribe({ userId: u, token: t })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res
        .status(200)
        .send(unsubscribePage('<p>You will not get product emails from December anymore.</p>'))
})

export const settingController = {
    showUnsubscribe,
    unsubscribe,
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
