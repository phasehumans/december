import type { Request, Response } from 'express'
import { templateService } from './template.service'
import { ProjectCategory } from '../../generated/prisma/enums'

const getAllTemplates = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

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
        return res.status(500).json({
            success: false,
            error: error.message,
        })
    }
}

const getTemplateById = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
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
            message: 'templates fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message,
        })
    }
}

const getTemplatesByCategory = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
    const categoryParam = req.params.category as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!categoryParam) {
        return res.status(400).json({
            success: false,
            message: 'category is required',
        })
    }

    if (!Object.values(ProjectCategory).includes(categoryParam as ProjectCategory)) {
        return res.status(400).json({
            success: false,
            message: 'invalid category',
        })
    }

    const category = categoryParam as ProjectCategory

    try {
        const result = await templateService.getTemplatesByCategory(category)
        return res.status(200).json({
            success: true,
            message: 'templates fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message,
        })
    }
}

const remixProject = async () => {}

export const templateController = {
    getAllTemplates,
    getTemplateById,
    getTemplatesByCategory,
    remixProject,
}
