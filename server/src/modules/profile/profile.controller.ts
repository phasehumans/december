import type { Request, Response } from 'express'

import { profileService } from './profile.service'
import {
    changePasswordSchema,
    updateNameSchema,
    updateNotificationSchema,
    updateUsernameSchema,
} from './profile.schema'

const getProfile = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

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
    const userId = req.userId as string | undefined
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
    const userId = req.userId as string | undefined
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
    const userId = req.userId as string | undefined
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
    const userId = req.userId as string | undefined
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

const getQuickInfo = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await profileService.getQuickInfo(userId)
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

const signout = async (req: Request, res: Response) => {}

const signoutAll = async (req: Request, res: Response) => {}

const deleteAccount = async (req: Request, res: Response) => {}

export const profileController = {
    getProfile,
    updateName,
    updatedUsername,
    changePassword,
    updateNotifications,
    connectGithub,
    getQuickInfo,
    signout,
    signoutAll,
    deleteAccount,
}
