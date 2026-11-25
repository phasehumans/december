import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    updateNameSchema,
    updateNotificationSchema,
    updateOnboardingSchema,
    updateModelSourceSchema,
    updateSessionDefaultsSchema,
    updateToolDenyRulesSchema,
    updatePreferencesSchema,
    updateSupportAccessSchema,
    dataExportDownloadSchema,
    updatePullRequestSettingsSchema,
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

    const settings = updateNotificationSchema.parse(req.body)
    const result = await settingService.updateNotifications({ userId, settings })
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

const updateSessionDefaults = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { defaultPlanFirst, defaultEffort, defaultOpenPullRequest } =
        updateSessionDefaultsSchema.parse(req.body)
    const result = await settingService.updateSessionDefaults({
        userId,
        defaultPlanFirst,
        defaultEffort,
        defaultOpenPullRequest,
    })
    return sendSuccess(res, 'session defaults updated', result)
})

const updateSupportAccess = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { enabled } = updateSupportAccessSchema.parse(req.body)
    const result = await settingService.updateSupportAccess({ userId, enabled })
    return sendSuccess(res, 'support access updated', result)
})

const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const preferences = updatePreferencesSchema.parse(req.body)
    const result = await settingService.updatePreferences({ userId, preferences })
    return sendSuccess(res, 'preferences updated', result)
})

const getDataExport = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.getDataExport({ userId })
    return sendSuccess(res, 'data export fetched', result)
})

const requestDataExport = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.requestDataExport({ userId })
    return sendSuccess(res, 'data export requested, a link will be emailed', result, 202)
})

const getToolDenyRules = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }
    const result = await settingService.getToolDenyRules({ userId })
    return sendSuccess(res, 'permission rules fetched', result)
})

const updateToolDenyRules = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }
    const { rules } = updateToolDenyRulesSchema.parse(req.body)
    const result = await settingService.updateToolDenyRules({ userId, rules })
    return sendSuccess(res, 'permission rules updated', result)
})

const getPullRequestSettings = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.getPullRequestSettings({ userId })
    return sendSuccess(res, 'pull request settings fetched successfully', result)
})

const updatePullRequestSettings = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const settings = updatePullRequestSettingsSchema.parse(req.body)
    const result = await settingService.updatePullRequestSettings({ userId, settings })
    return sendSuccess(res, 'pull request settings updated', result)
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
const simplePage = (title: string, content: string) =>
    `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title></head><body style="font-family: system-ui, sans-serif; background: #141414; color: #ededed; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">${content}</body></html>`

const unsubscribePage = (content: string) => simplePage('Unsubscribe', content)

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

// the link in the export email: a browser opens it, so errors are a small page, not json
const downloadDataExport = async (req: Request, res: Response) => {
    try {
        const { id, t } = dataExportDownloadSchema.parse({ id: req.params.id, t: req.query.t })
        const { body, fileName } = await settingService.downloadDataExport({
            exportId: id,
            token: t,
        })
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).send(Buffer.from(body))
    } catch (error) {
        const status = error instanceof AppError ? error.statusCode : 404
        const message =
            error instanceof AppError && status < 500
                ? error.message
                : 'this download link is not valid'
        if (!(error instanceof AppError)) {
            console.error('[Setting] data export download failed:', error)
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res
            .status(status >= 500 ? 404 : status)
            .send(
                simplePage(
                    'Data export',
                    `<p>${message.charAt(0).toUpperCase()}${message.slice(1)}. Ask for a new export on the Account page.</p>`
                )
            )
    }
}

export const settingController = {
    getDataExport,
    requestDataExport,
    downloadDataExport,
    showUnsubscribe,
    unsubscribe,
    getMe,
    getProfile,
    updateName,
    updateNotifications,
    updateModelSource,
    updateSessionDefaults,
    getToolDenyRules,
    updateToolDenyRules,
    updateSupportAccess,
    updatePreferences,
    getPullRequestSettings,
    updatePullRequestSettings,
    getOnboarding,
    updateOnboarding,
    completeOnboarding,
    submitFeedback,
}
