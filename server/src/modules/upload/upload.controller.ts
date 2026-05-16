import { importIdParamSchema, uploadRepoSchema } from './upload.schema'
import { uploadService } from './upload.service'

import type { Request, Response } from 'express'

const getErrorStatus = (message: string) => {
    const normalized = message.toLowerCase()

    if (normalized.includes('not found')) return 404
    if (
        normalized.includes('required') ||
        normalized.includes('invalid') ||
        normalized.includes('only zip') ||
        normalized.includes('too large') ||
        normalized.includes('access token') ||
        normalized.includes('github')
    ) {
        return 400
    }

    return 500
}

const getUserGithubRepos = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await uploadService.listGithubRepos(userId)
        return res.status(200).json({
            success: true,
            message: 'repos fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message,
        })
    }
}

const importFromGithub = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = uploadRepoSchema.safeParse(req.body)

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
        const { repoURL } = parseData.data

        const result = await uploadService.importFromGithub({ repoURL, userId })
        return res.status(202).json({
            success: true,
            message: 'import queued',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const importFromZip = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const file = (req as any).file
    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'zip file is required',
        })
    }

    try {
        const result = await uploadService.importFromZip({
            zipFile: file,
            userId,
        })

        return res.status(202).json({
            success: true,
            message: 'import queued',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const getImportStatus = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseParams = importIdParamSchema.safeParse(req.params)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseParams.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseParams.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await uploadService.getImportStatus({
            userId,
            importId: parseParams.data.id,
        })

        return res.status(200).json({
            success: true,
            message: 'import status fetched',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const retryImport = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseParams = importIdParamSchema.safeParse(req.params)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseParams.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseParams.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await uploadService.retryImport({
            userId,
            importId: parseParams.data.id,
        })

        return res.status(202).json({
            success: true,
            message: 'import retry queued',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

export const uploadController = {
    importFromGithub,
    importFromZip,
    getImportStatus,
    retryImport,
}
