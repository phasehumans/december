import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { notificationService } from '../notification/notification.service'

import { integrationRepository } from './integration.repository'

import type { ConnectVercel, ConnectGithub, HandleGitHubOAuth } from './integration.types'

const connectVercel = async (data: ConnectVercel) => {
    const { code, userId, teamId, configurationId } = data

    const existingUser = await integrationRepository.findUserFirst(userId)

    if (!existingUser || existingUser.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    const redirectUri =
        env.VERCEL_REDIRECT_URI ||
        process.env.VERCEL_REDIRECT_URI ||
        `${env.SERVER_URL}/api/v1/integrations/vercel/connect`

    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
            client_id: process.env.VERCEL_CLIENT_ID!,
            client_secret: process.env.VERCEL_CLIENT_SECRET!,
            code,
            redirect_uri: redirectUri,
        }).toString(),
    })

    const rawResponse = await tokenResponse.text()

    if (!tokenResponse.ok) {
        throw new AppError(rawResponse, 400)
    }

    const tokenData = JSON.parse(rawResponse) as { access_token?: string }

    const accessToken = tokenData.access_token

    if (!accessToken) {
        throw new AppError('vercel access token missing', 400)
    }

    const updatedUser = await integrationRepository.updateUserVercel({
        id: userId,
        vercelAccessToken: accessToken,
        vercelTeamId: teamId ?? null,
        vercelConfigurationId: configurationId ?? null,
    })

    try {
        await notificationService.sendNotificationToUser({
            userId,
            title: 'Vercel Connected',
            message: 'Successfully connected with Vercel integration!',
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('Failed to send vercel connection notification:', error)
    }

    return updatedUser
}

const connectGithub = async (data: ConnectGithub) => {
    const { username, accessToken, userId } = data

    const existingUser = await integrationRepository.findUserFirst(userId)

    if (!existingUser || existingUser.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    try {
        const updatedUser = await integrationRepository.updateUserGithub({
            id: userId,
            username,
            accessToken,
        })

        try {
            await notificationService.sendNotificationToUser({
                userId,
                title: 'GitHub Connected',
                message: `Successfully connected with GitHub integration as @${username}!`,
                type: 'SUCCESS',
            })
        } catch (error) {
            console.error('Failed to send github connection notification:', error)
        }

        return updatedUser
    } catch (error: any) {
        if (error.code === 'P2025') {
            throw new AppError('user not found', 404)
        }
        throw error
    }
}

const handleGitHubOAuth = async (data: HandleGitHubOAuth) => {
    const { code, userId } = data
    type GithubTokenResponse = {
        access_token?: string
        token_type?: string
        scope?: string
        error?: string
        error_description?: string
    }

    const clientId = env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID
    const clientSecret = env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
        }),
    })

    const tokenData = (await tokenResponse.json()) as GithubTokenResponse
    if (tokenData.error || !tokenData.access_token) {
        throw new AppError(
            tokenData.error_description ||
                tokenData.error ||
                'failed to obtain github access token',
            400
        )
    }

    const accessToken = tokenData.access_token

    const userRes = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'December-App',
        },
    })

    if (!userRes.ok) {
        throw new AppError('failed to fetch github user profile', 400)
    }

    const githubUser: any = await userRes.json()
    const username = githubUser.login

    return connectGithub({ userId, accessToken, username })
}

export const integrationsService = {
    connectVercel,
    connectGithub,
    handleGitHubOAuth,
}
