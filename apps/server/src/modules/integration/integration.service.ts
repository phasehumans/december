import { encryptText } from '@december/shared/crypto'
import { GitProviderError, gitlabOAuth, resolveAccessToken } from '@december/shared/git'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { notificationService } from '../notification/notification.service'

import { integrationRepository } from './integration.repository'
import { getGitlabOAuthApp } from './integration.utils'

import type {
    ConnectGitlab,
    ConnectGithub,
    GetGitlabAuthorizeUrl,
    GitlabStatus,
    GitlabUser,
    HandleGitHubOAuth,
} from './integration.types'

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
        // no inbox item: the user just did it and the Connections page shows it (R1)
        return await integrationRepository.updateUserGithub({
            id: userId,
            username,
            accessToken,
            githubId: githubIdToSave,
        })
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

const requireGitlabApp = () => {
    const app = getGitlabOAuthApp()
    if (!app) {
        throw new AppError('GitLab is not available yet', 503)
    }
    return app
}

const getGitlabAuthorizeUrl = async (data: GetGitlabAuthorizeUrl) => {
    const { state } = data
    const { clientId, redirectUri } = requireGitlabApp()
    return gitlabOAuth.getAuthorizeUrl({ clientId, redirectUri, state })
}

const connectGitlab = async (data: ConnectGitlab) => {
    const { code, userId } = data
    const app = requireGitlabApp()

    let tokens
    let gitlabUser
    try {
        tokens = await gitlabOAuth.exchangeCode({ ...app, code })
        gitlabUser = await gitlabOAuth.getUser({ token: tokens.accessToken })
    } catch (error) {
        if (error instanceof GitProviderError) {
            throw new AppError('GitLab sign-in failed', 400)
        }
        throw error
    }

    // one gitlab account belongs to one december account, like the github id
    const owner = await integrationRepository.findGitlabOwner(gitlabUser.id)
    if (owner && owner.userId !== userId) {
        throw new AppError('This GitLab account is connected to another December account', 409)
    }

    const connection = await integrationRepository.upsertGitlabConnection({
        userId,
        externalId: gitlabUser.id,
        username: gitlabUser.username,
        encryptedAccessToken: encryptText({
            text: tokens.accessToken,
            keyHex: env.SECRETS_ENC_KEY,
        }),
        encryptedRefreshToken: tokens.refreshToken
            ? encryptText({ text: tokens.refreshToken, keyHex: env.SECRETS_ENC_KEY })
            : null,
        expiresAt: tokens.expiresAt,
    })

    // no inbox item: the user just did it and the Connections page shows it (R1)
    return connection
}

const getGitlabStatus = async (data: GitlabUser): Promise<GitlabStatus> => {
    const { userId } = data
    const connection = await integrationRepository.findGitlabConnection(userId)
    return {
        available: getGitlabOAuthApp() !== null,
        connected: connection !== null,
        username: connection?.username ?? null,
    }
}

const disconnectGitlab = async (data: GitlabUser) => {
    const { userId } = data
    await integrationRepository.deleteGitlabConnection(userId)
}

// the plain gitlab token for a server-side call; refreshed first when it is about to expire
const getGitlabAccessToken = async (data: GitlabUser): Promise<string> => {
    const { userId } = data
    const connection = await integrationRepository.findGitlabConnectionTokens(userId)
    if (!connection) {
        throw new AppError('gitlab is not connected', 401)
    }

    try {
        return await resolveAccessToken({
            connection,
            keyHex: env.SECRETS_ENC_KEY,
            oauthApp: getGitlabOAuthApp() ?? undefined,
            save: (update) => integrationRepository.updateGitlabTokens(userId, update),
            reload: () => integrationRepository.findGitlabConnectionTokens(userId),
        })
    } catch (error) {
        if (error instanceof GitProviderError) {
            // N5: one "Reconnect GitLab" item while it stays unread, not one per failed call
            await notificationService
                .sendNotificationOnce({
                    userId,
                    title: 'Reconnect GitLab',
                    message: 'December could not renew your GitLab sign-in. Connect it again.',
                    type: 'WARNING',
                    link: '/settings/connections',
                })
                .catch((noticeError) => {
                    console.error('[Integration] reconnect notice failed:', noticeError)
                })
            throw new AppError(error.message, 401)
        }
        throw error
    }
}

export const integrationsService = {
    connectGithub,
    handleGitHubOAuth,
    getGitlabAuthorizeUrl,
    connectGitlab,
    getGitlabStatus,
    disconnectGitlab,
    getGitlabAccessToken,
}
