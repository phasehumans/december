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
    if (owner && owner.userId !== userId && owner.user.isDeleted) {
        // a deleted account owns nothing: the oauth sign-in just proved who owns it
        await integrationRepository.deleteGitlabConnection(owner.userId)
    } else if (owner && owner.userId !== userId) {
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
    getGitlabAuthorizeUrl,
    connectGitlab,
    getGitlabStatus,
    disconnectGitlab,
    getGitlabAccessToken,
}
