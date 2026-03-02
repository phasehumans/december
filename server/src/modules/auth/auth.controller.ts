import { loginSchema, signupSchema } from './auth.schema'
import type { Request, Response } from 'express'
import { authService } from './auth.service'
import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

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

const google = async (req: Request, res: Response) => {
    const {code} = req.body

    const tokenResponse = await axios.post(
        "https://oauth2.googleapis.com/token",
        {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: "postmessage",
            grant_type: "authorization_code"
        }
    )

    const { id_token } = tokenResponse.data

    const ticket = await client.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()

    const {email, name, sub} = payload

    
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
    google,
    logout,
}
