import { loginSchema, signupSchema } from './auth.schema'
import type { Request, Response } from 'express'
import { authService } from './auth.service'
import { success } from 'zod'

const signup = async (req: Request, res: Response) => {
    const parseData = signupSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'invalid inputs',
            errors: parseData.error.flatten(),
        })
    }

    try {
        const result = await authService.signup(parseData.data)
        return res.status(201).json({
            success: true,
            message: 'user created successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(409).json({
            success: false,
            errors: error.message,
        })
    }
}

const login = async (req: Request, res: Response) => {
    const parseData = loginSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'invalid inputs',
            errors: parseData.error.flatten(),
        })
    }

    try {
        const result = await authService.login(parseData.data)
        return res.status(200).json({
            success: true,
            message: 'user login successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(401).json({
            success: false,
            errors: error.message,
        })
    }
}

const logout = async (req: Request, res: Response) => {
    try {
        await authService.logout()

        res.clearCookie('token')

        return res.status(200).json({
            success: true,
            message: 'logged out successfully',
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'internal server error',
            errors: error.message,
        })
    }
}

export const authController = {
    signup,
    login,
    logout,
}
