import type { Request, Response } from 'express'
import { profileService } from './profile.service'
import {
    changePasswordSchema,
    chatSuggestionsSchema,
    generationSoundSchema,
    updateNameSchema,
    updateNotificationSchema,
    updateUsernameSchema,
} from './profile.schema'
import { authCookie } from '../auth/auth.cookie'
import { AppError } from '../../utils/appError'

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

    const { password } = parseData.data

    try {
        const result = await profileService.changePassword({
            userId,
            password,
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

const connectGithub = async (req: Request, res: Response) => {
    const code = req.query.code as string
    const userId = req.query.state as string

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'no code provided',
        })
    }

    type GithubTokenResponse = {
        access_token: string
        token_type: string
        scope: string
    }

    try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        })

        const tokenData = (await tokenResponse.json()) as GithubTokenResponse
        const accessToken = tokenData.access_token

        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        const githubUser: any = await userRes.json()
        const username = githubUser.login

        // console.log(accessToken, username)

        await profileService.connectGithub({ userId, accessToken, username })
        return res.redirect('http://localhost:3000')
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect with github',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect with github',
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

export const profileController = {
    getInfo,
    getProfileCard,
    getProfile,
    updateName,
    updateUsername,
    changePassword,
    updateNotifications,
    connectGithub,
    signout,
    signoutAll,
    deleteAccount,
    chatSuggestions,
    generationSound,
}
