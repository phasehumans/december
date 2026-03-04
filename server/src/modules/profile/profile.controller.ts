import type { Request, Response } from 'express'
import { profileService } from './profile.service'
import { changePasswordSchema, updateNameSchema } from './profile.schema'

const getProfile = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await profileService.getProfile(userId)
        return res.status(200).json({
            success: true,
            message: 'profile fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            errors: error.message,
        })
    }
}

const updateName = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
    const parseData = updateNameSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const { name } = parseData.data
    try {
        const result = await profileService.updateName({
            userId,
            name,
        })
        return res.status(200).json({
            success: true,
            message: 'name updated successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            errors: error.message,
        })
    }
}

const changePassword = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
    const parseData = changePasswordSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const { password } = parseData.data

    try {
        const result = await profileService.changePassword({
            userId,
            password,
        })
        return res.status(200).json({
            success: true,
            message: 'password changed successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            errors: error.message,
        })
    }
}

const connectGithub = async (req: Request, res: Response) => {}

export const profileController = {
    getProfile,
    updateName,
    changePassword,
    connectGithub,
}
