import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    changePasswordSchema,
    chatSuggestionsSchema,
    generationSoundSchema,
    designSchema,
    updateNameSchema,
    updateNotificationSchema,
    updateUsernameSchema,
    updateAvatarUrlSchema,
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

const updateUsername = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = updateUsernameSchema.parse(req.body)
    const { username } = parseData

    const result = await settingService.updateUsername({ userId, username })
    return sendSuccess(res, 'username updated successfully', result)
})

const updateAvatarUrl = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = updateAvatarUrlSchema.parse(req.body)
    const { avatarUrl } = parseData

    const result = await settingService.updateAvatarUrl({ userId, avatarUrl })
    return sendSuccess(res, 'avatar updated successfully', result)
})

const changePassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = changePasswordSchema.parse(req.body)
    const { currentPassword, newPassword } = parseData

    const result = await settingService.changePassword({
        userId,
        currentPassword,
        newPassword,
    })
    return sendSuccess(res, 'password changed successfully', result)
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

const chatSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = chatSuggestionsSchema.parse(req.body)
    const { chatSuggestions } = parseData

    const result = await settingService.chatSuggestions({ userId, chatSuggestions })
    return sendSuccess(res, 'chat suggestions updated successfully', result)
})

const generationSound = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = generationSoundSchema.parse(req.body)
    const { generationSound } = parseData

    const result = await settingService.generationSound({ userId, generationSound })
    return sendSuccess(res, 'generation sound preference updated successfully', result)
})

const getdesign = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.getdesign({ userId })
    return sendSuccess(res, 'design fetched successfully', result)
})

const updatedesign = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parseData = designSchema.parse(req.body)
    const { design } = parseData

    const result = await settingService.updatedesign({ userId, design })
    return sendSuccess(res, 'design updated successfully', result)
})

const deletedesign = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    await settingService.deletedesign({ userId })
    return sendSuccess(res, 'design deleted successfully')
})

const completeOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await settingService.completeOnboarding({ userId })
    return sendSuccess(res, 'onboarding completed successfully', result)
})

export const settingController = {
    getMe,
    getProfile,
    updateName,
    updateUsername,
    updateAvatarUrl,
    changePassword,
    updateNotifications,
    chatSuggestions,
    generationSound,
    getdesign,
    updatedesign,
    deletedesign,
    completeOnboarding,
}
