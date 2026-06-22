import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { toggleLikeSchema, remixTemplateSchema } from './template.schema'
import { templateService } from './template.service'

import type { Request, Response } from 'express'

const getAllTemplates = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await templateService.getAllTemplates({ userId })
    return sendSuccess(res, 'templates fetched successfully', result)
})

const getTemplateById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const templateId = req.params.templateId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!templateId) {
        throw new AppError('template id is required', 400)
    }

    const result = await templateService.getTemplateById({ userId, templateId })
    return sendSuccess(res, 'template fetched successfully', result)
})

const getFeaturedTemplates = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await templateService.getFeaturedTemplates({ userId })
    return sendSuccess(res, 'featured templates fetched successfully', result)
})

const remixTemplate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const templateId = req.params.templateId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!templateId) {
        throw new AppError('template id is required', 400)
    }

    const parseResult = remixTemplateSchema.parse(req.body || {})
    const { name } = parseResult

    const result = await templateService.remixTemplate({ userId, templateId, name })
    return sendSuccess(res, 'remix template successfully', result)
})

const toggleLike = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const templateId = req.params.templateId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!templateId) {
        throw new AppError('template id is required', 400)
    }

    const parseData = toggleLikeSchema.parse(req.body)
    const { isLiked } = parseData

    const result = await templateService.toggleLike({ userId, templateId, isLiked })
    return sendSuccess(res, 'updated like state successfully', result)
})

const getTemplatePreviewImage = asyncHandler(async (req: Request, res: Response) => {
    const templateId = req.params.templateId as string | undefined

    if (!templateId) {
        throw new AppError('template id is required', 400)
    }

    const imageBuffer = await templateService.getTemplatePreviewImage({ templateId })
    if (!imageBuffer) {
        throw new AppError('preview image not found', 404)
    }
    res.setHeader('Content-Type', 'image/png')
    return res.status(200).send(imageBuffer)
})

export const templateController = {
    getAllTemplates,
    getTemplateById,
    getFeaturedTemplates,
    remixTemplate,
    toggleLike,
    getTemplatePreviewImage,
}
