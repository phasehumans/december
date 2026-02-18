import type { Request, Response } from 'express'
import { profileService } from './profile.service'
import { changePasswordSchema, updateNameSchema } from './profile.schema'

const getProfile = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
    // console.log(userId)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const typedUserId: string = userId
        const result = await profileService.getProfile(typedUserId)
        return res.status(200).json({
            success: true,
            message: 'profile details',
            data: result,
        })
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: 'user doesnot exist',
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
            message: 'invalid inputs',
            errors: parseData.error.flatten(),
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const { name } = parseData.data
    const typedUserId: string = userId

    try {
        const result = await profileService.updateName({
            userId: typedUserId,
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
            message: 'failed to update name',
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
            message: 'invalid inputs',
            errors: parseData.error.flatten(),
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const { password } = parseData.data
    const typedUserId: string = userId

    try {
        const result = await profileService.changePassword({
            userId: typedUserId,
            password,
        })
        return res.status(200).json({
            success: true,
            message: 'password change successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: 'failed to change password',
            errors: error.message,
        })
    }
}

export const profileController = {
    getProfile,
    updateName,
    changePassword,
}
