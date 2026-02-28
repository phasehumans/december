import { loginSchema, signupSchema } from './auth.schema'
import type { Request, Response } from 'express'
import { authService } from './auth.service'

const signup = async (req: Request, res: Response) => {
    const parseData = signupSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    console.log(parseData)

    try {
        const result = await authService.signup(parseData.data)
        return res.status(201).json({
            success: true,
            message: 'signup successful"',
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
            message: 'logout successful',
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
        })
    }
}

export const authController = {
    signup,
    login,
    logout,
}
