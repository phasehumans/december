import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { notificationService } from '../notification/notification.service'

import { integrationRepository } from './integration.repository'

import type { ConnectGithub, HandleGitHubOAuth } from './integration.types'

const connectGithub = async (data: ConnectGithub) => {
    const { username, accessToken, userId, githubId } = data

    const existingUser = await integrationRepository.findUserFirst(userId)

    if (!existingUser || existingUser.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    // Save the GitHub id so the GitHub App webhook can match this user's installs. Only when
    // the user has none yet (it is also their GitHub login identity) and no other account
    // holds it (the column is unique).
    let githubIdToSave: string | undefined
    if (githubId && !existingUser.githubId) {
        const holder = await integrationRepository.findUserByGithubId(githubId)
        if (!holder) githubIdToSave = githubId
    }

    try {
        const updatedUser = await integrationRepository.updateUserGithub({
            id: userId,
            username,
            accessToken,
            githubId: githubIdToSave,
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
    const githubId = githubUser.id != null ? String(githubUser.id) : undefined

    return connectGithub({ userId, accessToken, username, githubId })
}

export const integrationsService = {
    connectGithub,
    handleGitHubOAuth,
}
