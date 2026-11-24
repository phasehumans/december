import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { authCookie } from './auth.cookie'
import {
    emailAuthStartSchema,
    emailAuthVerifySchema,
    googleAuthSchema,
    githubAuthSchema,
    pollDeviceTokenSchema,
    verifyUserCodeSchema,
    getDeviceStatusSchema,
} from './auth.schema'
import { authService } from './auth.service'

import type { Request, Response } from 'express'

const startEmailAuth = asyncHandler(async (req: Request, res: Response) => {
    const parseData = emailAuthStartSchema.parse(req.body)
    const result = await authService.startEmailAuth(parseData)
    return sendSuccess(res, 'otp sent to email', result)
})

const verifyEmailAuth = asyncHandler(async (req: Request, res: Response) => {
    const parseData = emailAuthVerifySchema.parse(req.body)

    const userAgent = req.get('user-agent') || 'unknown'
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'

    const result = await authService.verifyEmailAuth({ ...parseData, userAgent, ipAddress })
    authCookie.setAuthCookies(res, result.accessToken)

    return sendSuccess(res, 'login successful', result)
})

const google = asyncHandler(async (req: Request, res: Response) => {
    const parseData = googleAuthSchema.parse(req.body)
    const { code, credential } = parseData

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new AppError('google auth is not configured on server', 500)
    }

    let id_token: string | undefined = credential

    if (!id_token && code) {
        let tokenResponse
        try {
            tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
                code,
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: 'postmessage',
                grant_type: 'authorization_code',
            })
            id_token = tokenResponse.data?.id_token
        } catch (error: any) {
            const errorMsg =
                error?.response?.data?.error_description ||
                error.message ||
                'google authentication failed'
            throw new AppError(errorMsg.toLowerCase(), 400)
        }
    }

    if (!id_token) throw new AppError('google id token not found', 400)

    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID)
    const ticket = await client.verifyIdToken({
        idToken: id_token,
        audience: env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()

    if (!payload) throw new AppError('invalid token payload', 400)

    const { email, name, sub, email_verified } = payload

    if (!email || !name || !sub) throw new AppError('google fields required', 400)
    if (!email_verified) throw new AppError('email not verified', 400)

    const userAgent = req.get('user-agent') || 'unknown'
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'

    const result = await authService.google({ email, name, sub, userAgent, ipAddress })
    authCookie.setAuthCookies(res, result.accessToken)

    return sendSuccess(res, 'login successful', result)
})

const github = asyncHandler(async (req: Request, res: Response) => {
    const parseData = githubAuthSchema.parse(req.body)
    const { code } = parseData

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        throw new AppError('github auth is not configured on server', 500)
    }

    let tokenResponse
    try {
        tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code,
            },
            {
                headers: {
                    Accept: 'application/json',
                },
            }
        )
    } catch (error: any) {
        const errorMsg =
            error?.response?.data?.error_description ||
            error.message ||
            'github authentication failed'
        throw new AppError(errorMsg.toLowerCase(), 400)
    }

    if (tokenResponse.data?.error) {
        const errorDesc = tokenResponse.data.error_description || tokenResponse.data.error
        throw new AppError(`github oauth error: ${errorDesc}`, 400)
    }

    const { access_token } = tokenResponse.data

    if (!access_token) throw new AppError('github access token not found', 400)

    let userResponse
    try {
        userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        })
    } catch (error: any) {
        throw new AppError('failed to fetch github user profile', 400)
    }

    let emailsResponse
    try {
        emailsResponse = await axios.get('https://api.github.com/user/emails', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        })
    } catch (error: any) {
        throw new AppError('failed to fetch github user emails', 400)
    }

    if (!Array.isArray(emailsResponse.data)) {
        throw new AppError('failed to fetch github user emails', 400)
    }

    const primaryEmailObj = emailsResponse.data.find((e: any) => e.primary)
    if (!primaryEmailObj) {
        throw new AppError('no primary email found in github account', 400)
    }

    if (!primaryEmailObj.verified) {
        throw new AppError('github primary email is not verified', 400)
    }

    const email = primaryEmailObj.email
    const username = userResponse.data.login
    const name = userResponse.data.name || username
    const sub = String(userResponse.data.id)

    const userAgent = req.get('user-agent') || 'unknown'
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'

    const result = await authService.github({
        email,
        name,
        sub,
        username,
        userAgent,
        ipAddress,
    })
    authCookie.setAuthCookies(res, result.accessToken)

    return sendSuccess(res, 'login successful', result)
})

const refreshSession = asyncHandler(async (req: Request, res: Response) => {
    try {
        const token =
            req.body?.refreshToken ||
            req.body?.token ||
            req.cookies?.accessToken ||
            req.cookies?.refreshToken
        const result = await authService.refreshSession({
            refreshToken: token,
        })

        authCookie.setAccessTokenCookie(res, result.accessToken)

        return sendSuccess(res, 'session refreshed successfully', result)
    } catch (error) {
        if (
            error instanceof AppError &&
            (error.message === 'session revoked' ||
                error.message === 'session expired' ||
                error.message === 'account no longer exists' ||
                error.message === 'account has been deleted' ||
                error.message === 'invalid refresh token' ||
                error.message === 'token reuse detected' ||
                error.message === 'session not found')
        ) {
            authCookie.clearAuthCookies(res)
        }

        if (error instanceof AppError) {
            throw error
        }

        throw new AppError('failed to refresh session', 401)
    }
})

const signout = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    const sessionId = req.user?.sessionId

    if (!userId || !sessionId) {
        throw new AppError('unauthorized', 401)
    }

    await authService.signout({ userId, sessionId })
    authCookie.clearAuthCookies(res)

    return sendSuccess(res, 'signed out successfully')
})

const signoutAll = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    await authService.signoutAll({ userId })
    authCookie.clearAuthCookies(res)

    return sendSuccess(res, 'signed out from all devices successfully')
})

const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    await authService.deleteAccount({ userId })
    authCookie.clearAuthCookies(res)

    return sendSuccess(res, 'account deleted successfully')
})

const generateDeviceCode = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.generateDeviceCode()

    return sendSuccess(res, 'Device code generated', result)
})

const pollDeviceToken = asyncHandler(async (req: Request, res: Response) => {
    const parseData = pollDeviceTokenSchema.parse(req.body)

    const rawUserAgent = req.get('user-agent')
    const userAgent = rawUserAgent
        ? rawUserAgent.toLowerCase().includes('cli')
            ? rawUserAgent
            : `device-cli (${rawUserAgent})`
        : 'device-cli'
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'

    const result = await authService.pollDeviceToken({ ...parseData, userAgent, ipAddress })

    return sendSuccess(res, 'Token retrieved successfully', result)
})

const verifyUserCode = asyncHandler(async (req: Request, res: Response) => {
    const parseData = verifyUserCodeSchema.parse(req.body)
    const userId = req.user?.userId

    if (!userId) {
        throw new AppError('Unauthorized', 401)
    }

    const result = await authService.verifyUserCode({ ...parseData, userId })

    return sendSuccess(res, 'device successfully authorized', result)
})

const getDeviceStatus = asyncHandler(async (req: Request, res: Response) => {
    const parseData = getDeviceStatusSchema.parse(req.query)
    const userId = req.user?.userId

    if (!userId) {
        throw new AppError('Unauthorized', 401)
    }

    const result = await authService.getDeviceStatus({ userId, userCode: parseData.code })

    return sendSuccess(res, 'device status retrieved', result)
})

export const authController = {
    startEmailAuth,
    verifyEmailAuth,
    google,
    github,
    refreshSession,
    signout,
    signoutAll,
    deleteAccount,
    generateDeviceCode,
    pollDeviceToken,
    verifyUserCode,
    getDeviceStatus,
}
