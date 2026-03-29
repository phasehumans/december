import type { Request, Response } from 'express'
import { runtimeService } from './runtime.service'
import {
    previewIdParamSchema,
    runtimeStatusCallbackSchema,
    startPreviewSchema,
} from './runtime.schema'

const getErrorStatus = (message: string) =>
    message.toLowerCase().includes('not found') ? 404 : 500

const startPreview = async (req: Request, res: Response) => {
    const parseData = startPreviewSchema.safeParse(req.body)
    const userId = req.userId as string | undefined

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await runtimeService.startPreview({
            userId,
            projectId: parseData.data.projectId,
            versionId: parseData.data.versionId,
        })

        return res.status(200).json({
            success: true,
            message: 'preview started',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const getPreviewStatus = async (req: Request, res: Response) => {
    const parseParams = previewIdParamSchema.safeParse(req.params)
    const userId = req.userId as string | undefined

    if (!parseParams.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseParams.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await runtimeService.getPreviewStatus({
            userId,
            previewId: parseParams.data.id,
        })

        return res.status(200).json({
            success: true,
            message: 'preview status fetched',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const deletePreview = async (req: Request, res: Response) => {
    const parseParams = previewIdParamSchema.safeParse(req.params)
    const userId = req.userId as string | undefined

    if (!parseParams.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseParams.error.flatten().fieldErrors,
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await runtimeService.deletePreview({
            userId,
            previewId: parseParams.data.id,
        })

        return res.status(200).json({
            success: true,
            message: 'preview deleted',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const receiveRuntimeStatus = async (req: Request, res: Response) => {
    const parseParams = previewIdParamSchema.safeParse(req.params)
    const parseBody = runtimeStatusCallbackSchema.safeParse(req.body)
    const expectedSecret = process.env.RUNTIME_SHARED_SECRET
    const receivedSecret = req.header('x-phasehumans-runtime-secret')

    if (expectedSecret && receivedSecret !== expectedSecret) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized runtime callback',
        })
    }

    if (!parseParams.success || !parseBody.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: {
                ...(parseParams.success ? {} : parseParams.error.flatten().fieldErrors),
                ...(parseBody.success ? {} : parseBody.error.flatten().fieldErrors),
            },
        })
    }

    const result = runtimeService.recordRuntimeStatus(parseParams.data.id, {
        previewId: parseBody.data.previewId,
        projectId: parseBody.data.projectId,
        state: parseBody.data.state,
        backendStatus: parseBody.data.status,
        currentVersion: parseBody.data.currentVersion ?? null,
        healthyVersion: parseBody.data.healthyVersion ?? null,
        previewUrl: parseBody.data.previewUrl ?? null,
        lastError: parseBody.data.error
            ? {
                  class: parseBody.data.error.class,
                  code: parseBody.data.error.code,
                  message: parseBody.data.error.message,
                  detail: parseBody.data.error.detail ?? null,
                  retryable: parseBody.data.error.retryable,
              }
            : null,
        updatedAt: parseBody.data.updatedAt,
    })

    return res.status(200).json({
        success: true,
        message: 'runtime status recorded',
        data: result,
    })
}

export const runtimeController = {
    startPreview,
    getPreviewStatus,
    deletePreview,
    receiveRuntimeStatus,
}
