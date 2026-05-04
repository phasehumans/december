import type { Request, Response } from 'express'
import { templateService } from './template.service'
import { AppError } from '../../utils/appError'
import { toggleLikeSchema } from './template.schema'
import { success } from 'zod'

const getAllTemplates = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await templateService.getAllTemplates()
        return res.status(200).json({
            success: true,
            message: 'templates fetched successfully',
            data: result,
        })
    } catch (error: any) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch templates',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch templates',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getTemplateById = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const templateId = req.params.templateId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: true,
            message: 'unauthorized',
        })
    }

    if (!templateId) {
        return res.status(400).json({
            success: true,
            message: 'templateId is required',
        })
    }

    try {
        const result = await templateService.getTemplateById(templateId)
        return res.status(200).json({
            success: true,
            message: 'template fetched successfully',
            data: result,
        })
    } catch (error: any) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch template',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch template',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getFeaturedTemplates = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await templateService.getFeaturedTemplates()
        return res.status(200).json({
            success: true,
            message: 'featured templates fetched successfully',
            data: result,
        })
    } catch (error: any) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch featured templates',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch featured templates',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const remixTemplate = async (req: Request, res: Response) => {}

const toggleLike = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const templateId = req.params.templateId as string | undefined
    const parseData = toggleLikeSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!templateId) {
        return res.status(400).json({
            success: false,
            message: 'templateId is required',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { isLiked } = parseData.data

    try {
        const result = await templateService.toggleLike({ userId, templateId, isLiked })
        return res.status(200).json({
            success: true,
            message: 'updated like state successfully',
            data: result,
        })
    } catch (error: any) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update like state',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update like state',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

export const templateController = {
    getAllTemplates,
    getTemplateById,
    getFeaturedTemplates,
    remixTemplate,
    toggleLike,
}
