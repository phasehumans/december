import { AppError } from '../../shared/appError'

import { saveCanvasSchema, webClipRequestSchema } from '@december/shared'
import { canvasService } from './canvas.service'

import type { Request, Response } from 'express'

const createWebClips = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = webClipRequestSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { url, projectId } = parseData.data

    try {
        const result = await canvasService.createWebClips({ url, userId, projectId })
        return res.status(200).json({
            success: true,
            message: 'web clips created successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to create web clips',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to create web clips',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const saveCanvas = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = saveCanvasSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await canvasService.saveCanvas({
            userId,
            ...parseData.data,
        })
        return res.status(200).json({
            success: true,
            message: 'canvas saved successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to save canvas',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to save canvas',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

export const canvasController = {
    createWebClips,
    saveCanvas,
}
