import type { Request, Response } from 'express'
import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'

import { authService } from './auth.service'
import { loginSchema, signupSchema } from './auth.schema'
import { AppError } from '../../utils/appError'

// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const signup = async (req: Request, res: Response) => {
    const parseData = signupSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await authService.signup(parseData.data)
        return res.status(201).json({
            success: true,
            message: 'otp sent to email',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'signup failed',
                errors: error.message,
            })
        }
        return res.status(500).json({
            success: false,
            message: 'signup failed',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const verifyOtp = async (req: Request, res: Response) => {
    const { email, otp } = req.body

    if (!email || !otp) {
        return res.status(400).json({
            success: false,
            message: 'email and otp is required',
        })
    }

    try {
        const result = await authService.verifyOtp({ email, otp })
        return res.status(200).json({
            success: true,
            message: 'email verified successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'otp verification failed',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'otp verification failed',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const login = async (req: Request, res: Response) => {
    const parseData = loginSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await authService.login(parseData.data)
        return res.status(200).json({
            success: true,
            message: 'login successful',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'login failed',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'login failed',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const google = async (req: Request, res: Response) => {
    const { code } = req.body

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'authorization code is required',
        })
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({
            success: false,
            message: 'google auth is not configured on server',
        })
    }

    try {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: 'postmessage',
            grant_type: 'authorization_code',
        })

        const { id_token } = tokenResponse.data

        if (!id_token) {
            return res.status(400).json({
                success: false,
                message: 'google id token not found',
            })
        }

        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

        const ticket = await client.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        })

        const payload = ticket.getPayload()

        if (!payload) {
            return res.status(400).json({
                success: false,
                message: 'invalid token payload',
            })
        }

        const { email, name, sub, email_verified } = payload

        if (!email || !name || !sub) {
            return res.status(400).json({
                success: false,
                message: 'google fields required',
            })
        }

        if (!email_verified) {
            return res.status(400).json({
                success: false,
                message: 'email not verified',
            })
        }

        const result = await authService.google({ email, name, sub })
        return res.status(200).json({
            success: true,
            message: 'login successful',
            data: result,
        })
    } catch (error: any) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'google login failed',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'google login failed',
            errors:
                error?.response?.data?.error_description ||
                (error instanceof Error ? error.message : 'unknown error'),
        })
    }
}

export const authController = {
    signup,
    verifyOtp,
    login,
    google,
}
