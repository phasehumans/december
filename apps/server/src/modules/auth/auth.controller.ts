import {
    forgotPasswordRequestSchema,
    forgotPasswordResetSchema,
    forgotPasswordVerifySchema,
    loginSchema,
    signupSchema,
    verifyOtpSchema,
    googleAuthSchema,
} from '@december/shared'
import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { authCookie } from './auth.cookie'
import { authService } from './auth.service'

import type { Request, Response, NextFunction } from 'express'

const signup = asyncHandler(async (req: Request, res: Response) => {
    const parseData = signupSchema.parse(req.body)
    const result = await authService.signup(parseData)
    return sendSuccess(res, 'otp sent to email', result, 201)
})

const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const parseData = verifyOtpSchema.parse(req.body)
    const { email, otp } = parseData

    const userAgent = req.get('user-agent') || 'unknown'
    const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown'

    const result = await authService.verifyOtp({ email, otp, userAgent, ipAddress })
    authCookie.setAuthCookies(res, result.accessToken, result.refreshToken)

    return sendSuccess(res, 'email verified successfully')
})

const login = asyncHandler(async (req: Request, res: Response) => {
    const parseData = loginSchema.parse(req.body)

    const userAgent = req.get('user-agent') || 'unknown'
    const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown'

    const result = await authService.login({ ...parseData, userAgent, ipAddress })
    authCookie.setAuthCookies(res, result.accessToken, result.refreshToken)

    return sendSuccess(res, 'login successful')
})

const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const parseData = forgotPasswordRequestSchema.parse(req.body)
    await authService.requestPasswordReset(parseData)

    return sendSuccess(res, 'if an account exists, a reset code has been sent')
})

const verifyPasswordResetOtp = asyncHandler(async (req: Request, res: Response) => {
    const parseData = forgotPasswordVerifySchema.parse(req.body)
    await authService.verifyPasswordResetOtp(parseData)

    return sendSuccess(res, 'otp verified successfully')
})

const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const parseData = forgotPasswordResetSchema.parse(req.body)
    await authService.resetPassword(parseData)

    return sendSuccess(res, 'password reset successfully')
})

const google = asyncHandler(async (req: Request, res: Response) => {
    const parseData = googleAuthSchema.parse(req.body)
    const { code } = parseData

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new AppError('google auth is not configured on server', 500)
    }

    let tokenResponse
    try {
        tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: 'postmessage',
            grant_type: 'authorization_code',
        })
    } catch (error: any) {
        const errorMsg =
            error?.response?.data?.error_description ||
            error.message ||
            'google authentication failed'
        throw new AppError(errorMsg.toLowerCase(), 400)
    }

    const { id_token } = tokenResponse.data

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
    const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown'

    const result = await authService.google({ email, name, sub, userAgent, ipAddress })
    authCookie.setAuthCookies(res, result.accessToken, result.refreshToken)

    return sendSuccess(res, 'login successful')
})

const refreshSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.refreshSession({
            refreshToken: req.cookies?.refreshToken,
        })

        authCookie.setAccessTokenCookie(res, result.accessToken)
        authCookie.setRefreshTokenCookie(res, result.refreshToken)

        return sendSuccess(res, 'session refreshed successfully')
    } catch (error) {
        authCookie.clearAuthCookies(res)

        if (error instanceof AppError) {
            return next(error)
        }

        return next(new AppError('failed to refresh session', 401))
    }
}

export const authController = {
    signup,
    verifyOtp,
    login,
    requestPasswordReset,
    verifyPasswordResetOtp,
    resetPassword,
    google,
    refreshSession,
}
