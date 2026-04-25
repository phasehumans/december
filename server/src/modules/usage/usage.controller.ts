import type { Request, Response } from 'express'
import { usageService } from './usage.service'

const getCurrentUsage = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await usageService.getCurrentUsage(userId)
        return res.status(200).json({
            success: true,
            message: 'usage fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message,
        })
    }
}

const checkEnoughCredits = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await usageService.checkEnoughCredits(userId)
        return res.status(200).json({
            success: true,
            message: 'credits check successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message,
        })
    }
}

const recordUsageEvent = async (req: Request, res: Response) => {}

export const usageController = {
    getCurrentUsage,
    checkEnoughCredits,
    recordUsageEvent,
}
