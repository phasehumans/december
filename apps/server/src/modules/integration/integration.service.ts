import axios from 'axios'

import { AppError } from '../../shared/appError'
import { sendNotificationToUser } from '../notification/notification.service'

import { integrationRepository } from './integration.repository'

import type {
    ConnectVercel,
    ConnectSupabase,
    ConnectNotion,
    ConnectGithub,
} from './integration.types'

const connectVercel = async (data: ConnectVercel) => {
    const { code, userId, teamId, configurationId } = data

    const existingUser = await integrationRepository.findUserFirst(userId)

    if (!existingUser || existingUser.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
            client_id: process.env.VERCEL_CLIENT_ID!,
            client_secret: process.env.VERCEL_CLIENT_SECRET!,
            code,
            redirect_uri: process.env.VERCEL_REDIRECT_URI!,
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
        await sendNotificationToUser({
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

const connectSupabase = async (data: ConnectSupabase) => {
    const { userId, code } = data

    const existingUser = await integrationRepository.findUserFirst(userId)

    if (!existingUser || existingUser.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SUPABASE_REDIRECT_URI!,
        client_id: process.env.SUPABASE_CLIENT_ID!,
        client_secret: process.env.SUPABASE_CLIENT_SECRET!,
    })

    const response = await axios.post('https://api.supabase.com/v1/oauth/token', params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    })

    const tokenData = response.data

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    const updatedUser = await integrationRepository.updateUserSupabase({
        id: userId,
        supabaseAccessToken: tokenData.access_token,
        supabaseRefreshToken: tokenData.refresh_token,
        supabaseTokenExpiresAt: expiresAt,
        supabaseTokenScope: tokenData.scope ?? null,
    })

    try {
        await sendNotificationToUser({
            userId,
            title: 'Supabase Connected',
            message: 'Successfully connected with Supabase integration!',
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('Failed to send supabase connection notification:', error)
    }

    return updatedUser
}

const connectNotion = async (data: ConnectNotion) => {
    const { userId, code } = data

    const existingUser = await integrationRepository.findUserFirst(userId)

    if (!existingUser || existingUser.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    const response = await axios.post(
        'https://api.notion.com/v1/oauth/token',
        {
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.NOTION_REDIRECT_URI!,
        },
        {
            headers: {
                'Content-Type': 'application/json',
            },

            auth: {
                username: process.env.NOTION_CLIENT_ID!,
                password: process.env.NOTION_CLIENT_SECRET!,
            },
        }
    )

    const notionData = response.data

    const updatedUser = await integrationRepository.updateUserNotion({
        id: userId,
        notionAccessToken: notionData.access_token,
        notionWorkspaceId: notionData.workspace_id,
        notionWorkspaceName: notionData.workspace_name,
    })

    try {
        await sendNotificationToUser({
            userId,
            title: 'Notion Connected',
            message: `Successfully connected with Notion integration (${notionData.workspace_name})!`,
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('Failed to send notion connection notification:', error)
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
            await sendNotificationToUser({
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

export const integrationsService = {
    connectVercel,
    connectSupabase,
    connectNotion,
    connectGithub,
}
