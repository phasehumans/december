import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    previewIdParamSchema,
    runtimeStatusCallbackSchema,
    startPreviewSchema,
} from './runtime.schema'
import { runtimeService } from './runtime.service'

import type { Request, Response } from 'express'

const startPreview = asyncHandler(async (req: Request, res: Response) => {
    const parseData = startPreviewSchema.parse(req.body)
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await runtimeService.startPreview({
        userId,
        projectId: parseData.projectId,
        versionId: parseData.versionId,
    })

    return sendSuccess(res, 'preview started', result)
})

const getPreviewStatus = asyncHandler(async (req: Request, res: Response) => {
    const parseParams = previewIdParamSchema.parse(req.params)
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await runtimeService.getPreviewStatus({
        userId,
        previewId: parseParams.id,
    })

    return sendSuccess(res, 'preview status fetched', result)
})

const deletePreview = asyncHandler(async (req: Request, res: Response) => {
    const parseParams = previewIdParamSchema.parse(req.params)
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await runtimeService.deletePreview({
        userId,
        previewId: parseParams.id,
    })

    return sendSuccess(res, 'preview deleted', result)
})

const receiveRuntimeStatus = asyncHandler(async (req: Request, res: Response) => {
    const expectedSecret = process.env.RUNTIME_SHARED_SECRET
    const receivedSecret = req.header('x-december-runtime-secret')

    if (expectedSecret && receivedSecret !== expectedSecret) {
        throw new AppError('unauthorized runtime callback', 401)
    }

    const parseParams = previewIdParamSchema.parse(req.params)
    const parseBody = runtimeStatusCallbackSchema.parse(req.body)

    const result = runtimeService.recordRuntimeStatus({
        previewId: parseParams.id,
        status: {
            previewId: parseBody.previewId,
            sessionId: parseBody.projectId,
            state: parseBody.state,
            backendStatus: parseBody.status,
            currentVersion: parseBody.currentVersion ?? null,
            healthyVersion: parseBody.healthyVersion ?? null,
            previewUrl: parseBody.previewUrl ?? null,
            lastError: parseBody.error
                ? {
                      class: parseBody.error.class,
                      code: parseBody.error.code,
                      message: parseBody.error.message,
                      detail: parseBody.error.detail ?? null,
                      retryable: parseBody.error.retryable,
                  }
                : null,
            updatedAt: parseBody.updatedAt,
        },
    })

    return sendSuccess(res, 'runtime status recorded', result)
})

export const runtimeController = {
    startPreview,
    getPreviewStatus,
    deletePreview,
    receiveRuntimeStatus,
}
