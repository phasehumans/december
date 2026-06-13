import { AppError } from '../../shared/appError'
import { platformService } from './platform.service'
import { downloadProjectVersionSchema } from './platform.schema'
import type { Request, Response } from 'express'

const deployDecemberProject = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'project id is required',
        })
    }

    try {
        const result = await platformService.deployDecemberProject({ projectId, userId })
        return res.status(200).json({
            success: true,
            message: result.message,
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to deploy project to December',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to deploy project to December',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const downloadProjectVersion = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = downloadProjectVersionSchema.safeParse(req.query)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'project id is required',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const { versionId } = parseData.data

    try {
        const result = await platformService.downloadProjectVersion({
            userId,
            projectId,
            versionId,
        })
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
        return res.status(200).send(Buffer.from(result.zip))
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to download project',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to download project',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

export const platformController = {
    deployDecemberProject,
    downloadProjectVersion,
}
