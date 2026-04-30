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
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            errors: error.message,
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
        const result = await profileService.updateName({
            userId,
            name,
        })
        return res.status(200).json({
            success: true,
            message: 'name updated successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            errors: error.message,
        })
    }
}

const updatedUsername = async (req: Request, res: Response) => {
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
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
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
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            errors: error.message,
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
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
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

        const result = await profileService.connectGithub({ userId, accessToken, username })
        return res.redirect('http://localhost:3000')
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
        })
    }
}

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
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            errors: error.message,
        })
    }
}

const signout = async (req: Request, res: Response) => {
    const userId = req.user?.userId
    const sessionId = req.user?.sessionId

    if (!userId || !sessionId) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized',
        })
    }

    try {
        await profileService.signout({
            userId,
            sessionId,
        })

        authCookie.clearAuthCookies(res)

        return res.status(200).json({
            success: true,
            message: 'Signed out successfully',
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to sign out',
        })
    }
}

const signoutAll = async (req: Request, res: Response) => {
    const userId = req.user?.userId

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized',
        })
    }

    try {
        await profileService.signoutAll({
            userId,
        })

        authCookie.clearAuthCookies(res)

        return res.status(200).json({
            success: true,
            message: 'Signed out from all devices successfully',
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to sign out from all devices',
        })
    }
}

const deleteAccount = async (req: Request, res: Response) => {
    const userId = req.user?.userId

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized',
        })
    }

    try {
        await profileService.deleteAccount({
            userId,
        })

        authCookie.clearAuthCookies(res)

        return res.status(200).json({
            success: true,
            message: 'Account deleted successfully',
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete account',
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
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
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
            message: 'generation sound prefernce updated successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
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
            message: 'profile fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            errors: error.message,
        })
    }
}

export const profileController = {
    getProfile,
    updateName,
    updatedUsername,
    changePassword,
    updateNotifications,
    connectGithub,
    getInfo,
    signout,
    signoutAll,
    deleteAccount,
    chatSuggestions,
    generationSound,
    getProfileCard,
}
