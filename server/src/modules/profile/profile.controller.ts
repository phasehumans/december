import type { Request, Response } from 'express'
import { profileService } from './profile.service'

const getProfile = async (req: Request, res: Response) => {
  const userId = req.userId

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

const updateName = async (req: Request, res: Response) => {}

const changePassword = async (req: Request, res: Response) => {}

export const profileController = {
  getProfile,
  updateName,
  changePassword,
}
