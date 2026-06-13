import { AppError } from '../../shared/appError'

import { usageCheckQuerySchema } from './usage.schema'
import { usageService } from './usage.service'

import type { Request, Response } from 'express'

const getCurrentUsage = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

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
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch usage',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch usage',
            errors: error.message,
        })
    }
}

const checkEnoughCredits = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const parseQuery = usageCheckQuerySchema.safeParse(req.query)

    if (!parseQuery.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseQuery.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await usageService.checkEnoughCredits({
            userId,
            estimatedCostInCents: parseQuery.data.estimatedCostInCents,
        })
        return res.status(200).json({
            success: true,
            message: 'credits check successfully',
            data: result,
        })
    } catch (error: any) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to check credits',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to check credits',
            errors: error.message,
        })
    }
}

export const usageController = {
    getCurrentUsage,
    checkEnoughCredits,
}
