import fs from 'fs'
import path from 'path'

import { AppError } from '../../shared/appError'
import { authCookie } from '../auth/auth.cookie'

import {
    changePasswordSchema,
    chatSuggestionsSchema,
    generationSoundSchema,
    skillsSchema,
    updateNameSchema,
    updateNotificationSchema,
    updateUsernameSchema,
    updateAvatarUrlSchema,
} from './profile.schema'
import { profileService } from './profile.service'

import type { Request, Response } from 'express'

const getInfo = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await profileService.getInfo(userId)
        return res.status(200).json({
            success: true,
            message: 'info fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch info',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failes to fetch info',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getProfileCard = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await profileService.getProfileCard(userId)
        return res.status(200).json({
            success: true,
            message: 'profile card fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch profile card',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch profile card',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getProfile = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await profileService.getProfile(userId)
        return res.status(200).json({
            success: true,
            message: 'profile fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch profile',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch profile',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const updateName = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = updateNameSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const { name } = parseData.data
    try {
        const result = await profileService.updateName({ userId, name })
        return res.status(200).json({
            success: true,
            message: 'name updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update name',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update name',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const updateUsername = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = updateUsernameSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { username } = parseData.data

    try {
        const result = await profileService.updateUsername({ userId, username })
        return res.status(200).json({
            success: true,
            message: 'username updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update username',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update username',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const updateAvatarUrl = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = updateAvatarUrlSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { avatarUrl } = parseData.data

    try {
        const result = await profileService.updateAvatarUrl({ userId, avatarUrl })
        return res.status(200).json({
            success: true,
            message: 'avatar updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update avatar',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update avatar',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const changePassword = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = changePasswordSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const { currentPassword, newPassword } = parseData.data

    try {
        const result = await profileService.changePassword({
            userId,
            currentPassword,
            newPassword,
        })
        return res.status(200).json({
            success: true,
            message: 'password changed successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update password',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update password',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const updateNotifications = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = updateNotificationSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const { notifyProjectActivity, notifyProductUpdates, notifySecurityAlerts } = parseData.data

    try {
        const result = await profileService.updateNotifications({
            notifyProjectActivity,
            notifyProductUpdates,
            notifySecurityAlerts,
            userId,
        })
        return res.status(200).json({
            success: true,
            message: 'notifications preferences updated',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update notifications preferences',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update notifications preferences',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const signout = async (req: Request, res: Response) => {
    const userId = req.user?.userId
    const sessionId = req.user?.sessionId

    if (!userId || !sessionId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        await profileService.signout({ userId, sessionId })
        authCookie.clearAuthCookies(res)

        return res.status(200).json({
            success: true,
            message: 'signed out successfully',
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to sign out',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to sign out',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const signoutAll = async (req: Request, res: Response) => {
    const userId = req.user?.userId

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        await profileService.signoutAll({ userId })
        authCookie.clearAuthCookies(res)

        return res.status(200).json({
            success: true,
            message: 'signed out from all devices successfully',
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to signed out from all devices',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to signed out from all devices',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const deleteAccount = async (req: Request, res: Response) => {
    const userId = req.user?.userId

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        await profileService.deleteAccount({ userId })
        authCookie.clearAuthCookies(res)

        return res.status(200).json({
            success: true,
            message: 'account deleted successfully',
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to delete account',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to delete account',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const chatSuggestions = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = chatSuggestionsSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { chatSuggestions } = parseData.data

    try {
        const result = await profileService.chatSuggestions({ userId, chatSuggestions })
        return res.status(200).json({
            success: true,
            message: 'chat suggestions updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update chat suggestions',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update chat suggestions',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const generationSound = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = generationSoundSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { generationSound } = parseData.data

    try {
        const result = await profileService.generationSound({ userId, generationSound })
        return res.status(200).json({
            success: true,
            message: 'generation sound preference updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update generation sound preference',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update generation sound preference',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getSkills = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await profileService.getSkills(userId)
        return res.status(200).json({
            success: true,
            message: 'skills fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch skills',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch skills',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const updateSkills = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = skillsSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { skills } = parseData.data

    try {
        const result = await profileService.updateSkills({ userId, skills })
        return res.status(200).json({
            success: true,
            message: 'skills updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update skills',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update skills',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const deleteSkills = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        await profileService.deleteSkills(userId)
        return res.status(200).json({
            success: true,
            message: 'skills deleted successfully',
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to delete skills',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to delete skills',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const submitFeedback = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const { rating, feedback } = req.body

    try {
        const profile = await profileService.getProfile(userId)
        const username = profile.username || 'unknown_user'
        const email = profile.email || 'no_email'
        const name = profile.name || 'Anonymous'

        const dateStr = new Date().toISOString()
        const feedbackEntry = `\n### [${dateStr}] - @${username} (${name})\n- **Rating**: ${rating || 'None'}\n- **Feedback**: ${feedback || 'None'}\n`

        const feedbackFilePath = path.resolve(__dirname, '../../../../feedback.md')

        // Append to feedback.md (create it if it doesn't exist)
        if (!fs.existsSync(feedbackFilePath)) {
            fs.writeFileSync(feedbackFilePath, '# Product Feedback\n', 'utf8')
        }
        fs.appendFileSync(feedbackFilePath, feedbackEntry, 'utf8')

        return res.status(200).json({
            success: true,
            message: 'Feedback submitted successfully',
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to submit feedback',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

export const profileController = {
    getInfo,
    getProfileCard,
    getProfile,
    updateName,
    updateUsername,
    updateAvatarUrl,
    changePassword,
    updateNotifications,
    signout,
    signoutAll,
    deleteAccount,
    chatSuggestions,
    generationSound,
    getSkills,
    updateSkills,
    deleteSkills,
    submitFeedback,
}
